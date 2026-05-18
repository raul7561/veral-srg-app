import pdfplumber

with pdfplumber.open(r"C:\Users\rault\OneDrive\Documents\Veral Goup\Proyectos\veral-srg-app\SO63409.pdf") as pdf:
    page = pdf.pages[0]
    words = page.extract_words()
    page_mid = page.width / 2
    print(f"page_mid: {page_mid}")
    capture = False
    for w in words:
        if w["text"] == "Address":
            capture = True
            continue
        if capture and w["text"] in ["Customer", "Item", "Orders"]:
            break
        if capture:
            side = "LEFT" if float(w["x0"]) < page_mid else "RIGHT"
            print(f"{side:5} x0={w['x0']:.1f}  {w['text']}")
