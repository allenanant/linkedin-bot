"""Sanity check: tab management."""
print("CURRENT_TAB:", current_tab())
all_tabs = list_tabs(include_chrome=False)
print("TOTAL TABS:", len(all_tabs))
fts = [t for t in all_tabs if "/feed" in t["url"]]
print("FEED TABS:", len(fts))
if fts:
    switch_tab(fts[0]["targetId"])
    print("AFTER SWITCH:", current_tab())
