import sys
import os
import json
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

            job_data["progress"] = 40
            job_data["message"] = "Loading presentation slides..."
            update_status(status_file, job_data)

            try:
                page.goto(target_url, wait_until="networkidle", timeout=45000)
            except Exception:
                page.goto(target_url, wait_until="domcontentloaded", timeout=45000)

            job_data["progress"] = 60
            job_data["message"] = "Rendering slide data & Plotly charts..."
            update_status(status_file, job_data)

            # 1. Wait until 'computing', 'loading...', or spinners disappear from DOM
            try:
                page.wait_for_function("""() => {
                    const text = document.body.innerText.toLowerCase();
                    const hasLoading = text.includes('computing') || text.includes('loading...') || text.includes('fetching');
                    const hasSpinners = document.querySelector('.animate-spin, .animate-pulse');
                    return !hasLoading && !hasSpinners;
                }""", timeout=40000)
            except Exception as wait_err:
                print(f"[Worker] Readiness wait function timed out: {wait_err}")

            # 2. Wait until Plotly graphs have rendered SVG / Canvas surfaces
            try:
                page.wait_for_function("""() => {
                    const plots = Array.from(document.querySelectorAll('.js-plotly-plot'));
                    if (plots.length === 0) return true;
                    return plots.every(p => p.querySelector('.main-svg, .svg-container, canvas'));
                }""", timeout=20000)
            except Exception as plotly_err:
                print(f"[Worker] Plotly readiness wait timed out: {plotly_err}")

            # 3. Buffer delay for final CSS/SVG layout paint to settle
            page.wait_for_timeout(2000)

            job_data["progress"] = 85
            job_data["message"] = "Generating instant 1080p presentation PDF..."
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
