
import os

target_file = r"d:\OneDrive - e-con Systems India Pvt Ltd\Documents\Management AUTOMATION\backend\routers\admin.py"

def update_admin_router():
    with open(target_file, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update Import Statement
    old_import = """from slides_compute import (
    compute_slide1_data, 
    compute_slide2_data, 
    compute_slide3_data, 
    compute_slide4_data,
    compute_slide5_data,
    compute_slide6_data,
    compute_slide7_data,
    compute_slide8_data,
    compute_slide9_data
)"""
    
    new_import_lines = ["from slides_compute import ("]
    for i in range(1, 28):
        comma = "," if i < 27 else ""
        new_import_lines.append(f"    compute_slide{i}_data{comma}")
    new_import_lines.append(")")
    new_import = "\n".join(new_import_lines)
    
    if old_import in content:
        content = content.replace(old_import, new_import)
    else:
        # Fallback if specific formatting differs, try to find the block start
        print("Warning: Exact import block match failed. Attempting regex or manual check suggested.")
        # For now, let's assume the file hasn't changed since we read it.
        # Use a more robust check?
        pass

    # 2. Append New Routes
    new_routes = []
    
    start_slide = 10
    end_slide = 27
    
    # Mapping slide number to description for docstrings (approximate)
    descriptions = {
        10: "Europe Cumulative Performance", 11: "Europe Trend", 12: "Europe Pipeline",
        13: "US East Cumulative Performance", 14: "US East Trend", 15: "US East Pipeline",
        16: "Asean Cumulative Performance", 17: "Asean Trend", 18: "Asean Pipeline",
        19: "Japan Cumulative Performance", 20: "Japan Trend", 21: "Japan Pipeline",
        22: "KANZ Cumulative Performance", 23: "KANZ Trend", 24: "KANZ Pipeline",
        25: "Legacy Cumulative Performance", 26: "Legacy Trend", 27: "Legacy Pipeline",
    }
    
    for i in range(start_slide, end_slide + 1):
        desc = descriptions.get(i, f"Slide {i} Data")
        route_code = f'''
@router.get("/slides/slide{i}")
async def get_slide{i}_data():
    """
    Get computed data for Slide {i} of the presentation.
    {desc}
    """
    try:
        result = await compute_slide{i}_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute slide {i} data: {{str(e)}}")
'''
        new_routes.append(route_code)
    
    # Append content
    if not content.endswith("\n"):
        content += "\n"
    
    content += "".join(new_routes)
    
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Successfully updated admin.py with slides {start_slide}-{end_slide}")

if __name__ == "__main__":
    update_admin_router()
