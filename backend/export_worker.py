import sys
import os
import json
import time
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
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            )
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

            job_data["progress"] = 40
            job_data["message"] = "Loading presentation slides..."
            update_status(status_file, job_data)

            try:
                page.goto(target_url, wait_until="networkidle", timeout=120000)
            except Exception as e:
                print(f"[Worker] Warning: networkidle timeout {e}. Proceeding to DOM wait.")

            job_data["progress"] = 60
            job_data["message"] = "Waiting for every slide's data and visuals to render..."
            update_status(status_file, job_data)

            # Wait for every slide independently so a large deck reports useful
            # progress while its slower charts and 3D visuals finish rendering.
            render_timeout_seconds = 600
            render_deadline = time.monotonic() + render_timeout_seconds
            last_reported_ready = -1
            last_status_update = 0.0
            render_status = None

            while time.monotonic() < render_deadline:
                render_status = page.evaluate("""() => {
                    const state = window.__weeklyTrackerExportState;
                    const now = Date.now();
                    const slides = Array.from(document.querySelectorAll('.export-slide-item'));

                    const isSlideReady = (slide) => {
                        const text = slide.innerText.toLowerCase();
                        const hasLoading = text.includes('computing')
                            || text.includes('loading')
                            || text.includes('fetching')
                            || !!slide.querySelector('.animate-spin, .animate-pulse');
                        if (hasLoading) return false;

                        const imagesReady = Array.from(slide.querySelectorAll('img'))
                            .every(image => image.complete);
                        if (!imagesReady) return false;

                        return Array.from(slide.querySelectorAll('.js-plotly-plot')).every(plot => {
                            const rect = plot.getBoundingClientRect();
                            return rect.width > 0
                                && rect.height > 0
                                && !!plot.querySelector('.main-svg, .svg-container, canvas, .gl-container');
                        });
                    };

                    const readySlides = slides.filter(isSlideReady).length;
                    return {
                        totalSlides: slides.length,
                        readySlides,
                        pendingRequests: state?.pendingRequests ?? 0,
                        isReady: slides.length > 0
                            && readySlides === slides.length,
                    };
                }""")

                now = time.monotonic()
                ready_slides = render_status["readySlides"]
                total_slides = render_status["totalSlides"]
                if ready_slides != last_reported_ready or now - last_status_update >= 5:
                    job_data["progress"] = 60 + int(20 * ready_slides / max(total_slides, 1))
                    job_data["rendered_slides"] = ready_slides
                    job_data["total_slides"] = total_slides
                    job_data["message"] = (
                        f"Rendering slides: {ready_slides}/{total_slides} ready "
                        f"({render_status['pendingRequests']} data requests remaining)..."
                    )
                    update_status(status_file, job_data)
                    last_reported_ready = ready_slides
                    last_status_update = now

                if render_status["isReady"]:
                    break

                page.wait_for_timeout(1000)

            if not render_status or not render_status["isReady"]:
                ready_slides = render_status["readySlides"] if render_status else 0
                total_slides = render_status["totalSlides"] if render_status else 0
                raise RuntimeError(
                    f"RENDER_NOT_READY: {ready_slides}/{total_slides} slides finished rendering after "
                    f"{render_timeout_seconds // 60} minutes"
                )

            job_data["progress"] = 80
            job_data["rendered_slides"] = render_status["readySlides"]
            job_data["total_slides"] = render_status["totalSlides"]
            job_data["message"] = "All slides rendered. Starting PDF capture..."
            update_status(status_file, job_data)
            page.wait_for_timeout(2200)

            job_data["progress"] = 85
            job_data["message"] = "Generating 1080p presentation PDF..."
            update_status(status_file, job_data)

            # Fast single-pass 1080p PDF generation
            page.pdf(
                path=output_pdf,
                width="1920px",
                height="1080px",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                scale=1
            )

            browser.close()

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
