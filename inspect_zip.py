import zipfile
import os

zip_path = r"D:\Miracle Web Builder\site-export.zip"
print(f"Reading index.html from zip: {zip_path}")

if not os.path.exists(zip_path):
    print("Error: site-export.zip does not exist!")
    exit(1)

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    namelist = zip_ref.namelist()
    html_files = [x for x in namelist if x.endswith(".html")]
    print(f"HTML files in zip: {html_files}")
    
    if "index.html" in namelist:
        content = zip_ref.read("index.html").decode("utf-8", errors="ignore")
        print(f"Length of index.html: {len(content)}")
        
        # Let's extract all headings <h1>, <h2>, <h3> to see the structure of the page!
        import re
        headings = re.findall(r'<h[1-6][^>]*>(.*?)</h[1-6]>', content, re.IGNORECASE)
        print(f"Found {len(headings)} headings:")
        for h in headings[:30]:
            h_clean = re.sub('<[^<]+?>', '', h)
            print(f"  - {h_clean.strip()}")
            
        print("\nSearching for logo text:")
        logo_matches = re.findall(r'VIGILANT // IT SOLUTION|VIGILANT|MIRACLE', content, re.IGNORECASE)
        print(f"Logo/Miracle mentions: {set(logo_matches)}")
    else:
        print("index.html not found in the zip!")
