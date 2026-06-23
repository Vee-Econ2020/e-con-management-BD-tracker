
import requests
import json

try:
    r = requests.get("http://localhost:8000/api/admin/slides/slide4")
    data = r.json()
    anns = data.get("annotations", [])
    print(f"Found {len(anns)} annotations.")
    if anns:
        print("First annotation:", json.dumps(anns[0], indent=2))
        # Find a dynamic one
        dyn = next((a for a in anns if a.get("type") == "dynamic"), None)
        if dyn:
            print("First dynamic annotation:", json.dumps(dyn, indent=2))
        else:
            print("No dynamic annotations found!")
except Exception as e:
    print(e)
