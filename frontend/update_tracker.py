
import os

target_file = r"d:\OneDrive - e-con Systems India Pvt Ltd\Documents\Management AUTOMATION\frontend\src\pages\WeeklyTracker.tsx"

def update_tracker():
    with open(target_file, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add Imports
    imports = []
    for i in range(10, 28):
        imports.append(f"import Slide{i} from '../components/slides/Slide{i}';")
    
    import_block = "\n".join(imports)
    if "import Slide9 from '../components/slides/Slide9';" in content:
        content = content.replace(
            "import Slide9 from '../components/slides/Slide9';",
            "import Slide9 from '../components/slides/Slide9';\n" + import_block
        )

    # 2. Update slides array
    # const slides = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    new_slides_array = "const slides = [" + ", ".join(map(str, range(1, 28))) + "];"
    import re
    content = re.sub(r"const slides = \[.*?\];", new_slides_array, content)

    # 3. Update Preview List Rendering
    # Pattern: : slideNum === 9 ? (\n <Slide9 />\n ) : (
    
    preview_chain = []
    for i in range(10, 28):
        code = f""": slideNum === {i} ? (
                                <Slide{i} />
                            ) """
        preview_chain.append(code)
    
    preview_block = "".join(preview_chain)
    
    # We look for the end of the chain where Slide9 is
    # The file has:
    # : slideNum === 9 ? (
    #     <Slide9 />
    # ) : (
    
    if ": slideNum === 9 ? (" in content:
         # Need to be careful with formatting matches, simpler to find the specific block
         # Let's find the closing parenthesis of Slide9 block and append there
         pass
    
    # Actually, simpler regex replacement for the chain
    # Find the transition from Slide9 to default
    # The default is SlidePreview
    
    pattern_preview = r": slideNum === 9 \? \(\s*<Slide9 />\s*\) : \("
    replacement_preview = f": slideNum === 9 ? (\n                                <Slide9 />\n                            ) {preview_block}: ("
    
    content = re.sub(pattern_preview, replacement_preview, content)


    # 4. Update Slideshow Overlay Rendering
    # Pattern: : activeSlideIndex === 8 ? (\n <div ...>\n <Slide9 />\n </div>\n ) : (
    
    slideshow_chain = []
    for i in range(10, 28):
        # Index is i-1
        idx = i - 1
        code = f""": activeSlideIndex === {idx} ? (
                            <div style={{{{ width: '100%', height: '100%', maxWidth: '100%' }}}}>
                                <Slide{i} />
                            </div>
                        ) """
        slideshow_chain.append(code)
        
    slideshow_block = "".join(slideshow_chain)
    
    # Regex for Slide9 in slideshow (index 8)
    pattern_slideshow = r": activeSlideIndex === 8 \? \(\s*<div.*?>\s*<Slide9 />\s*</div>\s*\) : \("
    
    # Note: Regex dot matching newline needs re.DOTALL, but we have strict structure here
    # Use strict spacing or simpler split since we know the file content
    
    if ": activeSlideIndex === 8 ? (" in content:
        # Construct the replacement manually to avoid regex escaping hell
        chunk_start = ": activeSlideIndex === 8 ? ("
        chunk_end = ") : ("
        
        # We need to find the specific block for activeSlideIndex === 8 to insert AFTER it
        # But wait, the replacement needs to go inside the chain
        # Old: ... : index=8 ? (...) : (default)
        # New: ... : index=8 ? (...) : index=9 ? (...) ... : (default)
        
        split_point = content.find(chunk_start)
        if split_point != -1:
            # Find the closing component part
            # It ends with `) : (` which leads to the default case
            # We search for `) : (` AFTER the split point
            next_else = content.find(") : (", split_point)
            if next_else != -1:
                # Insert our new block before the ` : (`
                to_insert = slideshow_block
                # content = content[:next_else+1] + to_insert + content[next_else+1:] 
                # wait, `to_insert` starts with `: active...`
                # So we replace `) : (` with `) {to_insert}: (`
                
                # Verify we are editing the Slideshow part, not the preview part
                # The preview part variable is `slideNum`, slideshow is `activeSlideIndex`.
                # So searches for activeSlideIndex should be safe.
                
                content = content[:next_else+1] + " " + to_insert + content[next_else+1:]

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("Successfully updated WeeklyTracker.tsx")

if __name__ == "__main__":
    update_tracker()
