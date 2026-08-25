import sys
import os
import json
import time
import tempfile
import shutil
import traceback

def update_status(status_file: str, data: dict):
    """Write progress and status to job JSON file atomically"""
    try:
        tmp_file = f"{status_file}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp_file, status_file)
    except Exception as e:
        print(f"[Worker] Error writing status file: {e}")


def run_export():
    if len(sys.argv) < 3:
        print("Usage: export_worker.py <status_file> <output_pdf> [week] [start_slide] [end_slide] [frontend_url]")
        sys.exit(1)

    status_file = sys.argv[1]
    output_pdf = sys.argv[2]
    week = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "None" else ""
    start_slide = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "None" else ""
    end_slide = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != "None" else ""
    frontend_url = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] != "None" else "http://localhost:5173"

    job_data = {
        "status": "processing",
        "progress": 10,
        "message": "Initializing 1080p presentation engine...",
        "pdf_filename": os.path.basename(output_pdf),
        "file_path": output_pdf,
        "error": None
    }
    update_status(status_file, job_data)

    query_params = []
    if week:
        query_params.append(f"week={week}")
    query_params.append("export_server=true")
    if start_slide:
        query_params.append(f"start={start_slide}")
    if end_slide:
        query_params.append(f"end={end_slide}")

    target_url = f"{frontend_url.rstrip('/')}/weekly?{'&'.join(query_params)}"

    try:
        from playwright.sync_api import sync_playwright

        job_data["progress"] = 25
        job_data["message"] = "Launching headless browser (1080p)..."
        update_status(status_file, job_data)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--hide-scrollbars',
                    '--force-device-scale-factor=1',
                ]
            )
            # Match the exact fullscreen presentation resolution (1920x1080).
            # --hide-scrollbars prevents scrollbars from eating into this space,
            # so vw/vh CSS units in slides compute identically to the live fullscreen.
            context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            page = context.new_page()
            page.emulate_media(media="screen")

            # Install before navigation so requests made by slide effects are included.
            page.add_init_script("""() => {
                const state = {
                    pendingRequests: 0,
                    lastActivity: Date.now(),
                    lastDomChange: Date.now(),
                };
                window.__weeklyTrackerExportState = state;

                const markActivity = () => {
                    state.lastActivity = Date.now();
                };
                const beginRequest = () => {
                    state.pendingRequests += 1;
                    markActivity();
                };
                const endRequest = () => {
                    state.pendingRequests = Math.max(0, state.pendingRequests - 1);
                    markActivity();
                };

                const originalFetch = window.fetch;
                window.fetch = (...args) => {
                    beginRequest();
                    return originalFetch(...args).finally(endRequest);
                };

                const originalSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.send = function (...args) {
                    beginRequest();
                    this.addEventListener('loadend', endRequest, { once: true });
                    return originalSend.apply(this, args);
                };

                new MutationObserver(() => {
                    state.lastDomChange = Date.now();
                }).observe(document, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    characterData: true,
                });
            }""")

            base_url = f"{target_url}&slide="

            job_data["progress"] = 40
            job_data["message"] = "Loading presentation..."
            update_status(status_file, job_data)

            # Load the first slide so we can read the total slide count.
            try:
                page.goto(f"{base_url}0", wait_until="domcontentloaded", timeout=60000)
            except Exception as e:
                print(f"[Worker] Warning: first navigation slow {e}. Proceeding anyway.")

            total_slides = 0
            for _ in range(30):
                total_slides = page.evaluate("() => window.__WEEKLY_TRACKER_SLIDE_COUNT || 0")
                if total_slides and total_slides > 0:
                    break
                page.wait_for_timeout(500)

            if not total_slides or total_slides <= 0:
                raise RuntimeError("NO_SLIDES: could not determine how many slides to export")

            job_data["total_slides"] = total_slides

            # Capture each slide on its own page load. One slide at a time keeps
            # every page light and avoids overloading the backend with 150+
            # simultaneous data requests, which is what stalled the old exporter.
            temp_dir = tempfile.mkdtemp(prefix="wt_export_")
            png_paths = []
            per_slide_timeout_ms = 90000

            single_slide_ready = """() => {
                const state = window.__weeklyTrackerExportState;
                const root = document.getElementById('export-single-slide');
                if (!root) return false;
                if (state && state.pendingRequests > 0) return false;
                if (state && Date.now() - state.lastActivity < 500) return false;
                const text = root.innerText.toLowerCase();
                if (text.includes('computing') || text.includes('loading') || text.includes('fetching')) return false;
                if (root.querySelector('.animate-spin, .animate-pulse')) return false;
                const imagesReady = Array.from(root.querySelectorAll('img')).every(i => i.complete);
                if (!imagesReady) return false;
                return Array.from(root.querySelectorAll('.js-plotly-plot')).every(plot => {
                    const rect = plot.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0
                        && !!plot.querySelector('.main-svg, .svg-container, canvas, .gl-container');
                });
            }"""

            try:
                for index in range(total_slides):
                    if index > 0:
                        try:
                            page.goto(f"{base_url}{index}", wait_until="domcontentloaded", timeout=60000)
                        except Exception as nav_err:
                            print(f"[Worker] Slide {index} navigation slow: {nav_err}")

                    # Ensure the slide mounted and its data fetch has a chance to
                    # start (so the readiness check doesn't fire before loading).
                    try:
                        page.wait_for_selector("#export-single-slide", timeout=30000)
                    except Exception as mount_err:
                        print(f"[Worker] Slide {index} container missing: {mount_err}")
                    page.wait_for_timeout(700)

                    try:
                        page.wait_for_function(single_slide_ready, timeout=per_slide_timeout_ms)
                    except Exception as ready_err:
                        # Best-effort: capture whatever rendered rather than aborting
                        # the whole deck because of one slow slide.
                        print(f"[Worker] Slide {index} readiness timed out, capturing as-is: {ready_err}")

                    # Small settle for final chart/WebGL paint.
                    page.wait_for_timeout(500)

                    png_path = os.path.join(temp_dir, f"slide_{index:04d}.png")
                    slide_el = page.query_selector("#export-single-slide")
                    if slide_el:
                        # Capture the element directly — always gets the full 1920x1080
                        # div regardless of viewport scroll or scrollbar width.
                        slide_el.screenshot(path=png_path)
                    else:
                        # Fallback: viewport clip
                        page.screenshot(path=png_path, clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
                    png_paths.append(png_path)

                    captured = index + 1
                    job_data["progress"] = 40 + int(50 * captured / total_slides)
                    job_data["rendered_slides"] = captured
                    job_data["total_slides"] = total_slides
                    job_data["message"] = f"Capturing slides: {captured}/{total_slides}..."
                    update_status(status_file, job_data)

                browser.close()

                job_data["progress"] = 92
                job_data["message"] = f"Assembling {len(png_paths)}-page PDF..."
                update_status(status_file, job_data)

                from PIL import Image

                if not png_paths:
                    raise RuntimeError("NO_SLIDES: no slides were captured")

                frames = [Image.open(path).convert("RGB") for path in png_paths]
                frames[0].save(output_pdf, save_all=True, append_images=frames[1:])
                for frame in frames:
                    frame.close()
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        job_data["status"] = "completed"
        job_data["progress"] = 100
        job_data["message"] = "PDF export completed successfully!"
        update_status(status_file, job_data)
        print(f"[Worker] Export complete: {output_pdf}")

    except Exception as err:
        err_msg = traceback.format_exc()
        print(f"[Worker] Export failed:\n{err_msg}")
        job_data["status"] = "failed"
        job_data["error"] = str(err)
        job_data["message"] = f"Export failed: {str(err)}"
        update_status(status_file, job_data)

if __name__ == "__main__":
    run_export()
