
import os

target_file = r"d:\OneDrive - e-con Systems India Pvt Ltd\Documents\Management AUTOMATION\backend\slides_compute.py"

regions = [
    ("Europe", "Europe", "Europe"),
    ("US East", "US East", "US East"),
    ("Asean", "Asean", "Asean"),
    ("Japan", "Japan", "Japan"),
    ("KANZ", "KANZ", "KANZ"),
    ("Legacy", "Legacy", "Legacy") # DB Region, Target Category, Display Name (internal)
]

start_slide = 10

def append_regional_slides():
    new_code = []
    
    current_slide = start_slide
    
    for r_name, r_target, r_filter in regions:
        # 1. Cumulative (Like Slide 7)
        code_cum = f'''
async def compute_slide{current_slide}_data(db: AsyncIOMotorDatabase) -> Dict:
    """
    Compute data for Slide {current_slide} ({r_name} Cumulative Performance vs Targets).
    """
    return await _compute_cumulative_generic(
        db,
        region_name="{r_name}",
        target_category="{r_target}",
        filter_query={{"mRegion": "{r_filter}"}}
    )

'''
        new_code.append(code_cum)
        current_slide += 1
        
        # 2. Trend (Like Slide 8)
        code_trend = f'''
async def compute_slide{current_slide}_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide {current_slide} ({r_name} Pipeline Tracking Over Time).
    """
    return await _compute_trend_generic(
        db,
        region_name="{r_name}",
        target_category="{r_target}",
        filter_query={{"mRegion": "{r_filter}"}}
    )

'''
        new_code.append(code_trend)
        current_slide += 1
        
        # 3. Pipeline (Like Slide 9)
        code_pipe = f'''
async def compute_slide{current_slide}_data(db: AsyncIOMotorDatabase, week: int = None) -> Dict:
    """
    Compute data for Slide {current_slide} ({r_name} Actuals vs Pipeline Weekly Bars).
    """
    return await _compute_pipeline_generic(
        db,
        region_name="{r_name}",
        target_category="{r_target}",
        filter_query={{"mRegion": "{r_filter}"}}
    )

'''
        new_code.append(code_pipe)
        current_slide += 1

    with open(target_file, "a", encoding="utf-8") as f:
        f.writelines(new_code)
    
    print(f"Successfully appended slides {start_slide} to {current_slide-1}")

if __name__ == "__main__":
    append_regional_slides()
