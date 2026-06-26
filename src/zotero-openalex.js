if (!OpenAlexWorkID) var OpenAlexWorkID = {};

OpenAlexWorkID = {
    init({ id, version, rootURI }) {
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
    },

    addToWindow(window) {
        let document = window.document;
        let itemMenuPopup = document.querySelector("#zotero-itemmenu");
        if (!itemMenuPopup) return;

        let menuItem = document.createXULElement("menuitem");
        menuItem.setAttribute("label", "Get OpenAlex-WorkID");
        menuItem.setAttribute("id", "workid-menuitem");
        menuItem.addEventListener("command", async () => {            
            try {
                // Get selected items
                let selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
                if (!selectedItems || selectedItems.length === 0) {
                    window.alert("No items selected.");
                    return;
                }

                num_items = selectedItems.length;
                let num_items_added = 0;
                for (let i = 0; i < num_items; i++) {
                    let item = selectedItems[i];
                    if (!item.isRegularItem()) {
                        if (num_items==1) {
                            window.alert("Selected item is not a regular Zotero item.");
                        }
                        continue;
                    }

                    // Debug logging using Zotero's system
                    Zotero.debug("Selected item:");
                    Zotero.debug(item);
                    Zotero.debug("Item type: " + item.itemType);
                               
                    let data = await fetchOpenAlexJSON(item, window);
                    if (!data) {
                        if (num_items==1) {
                            window.alert("No Work ID found for the selected item. Check the item's DOI or Extra field.");
                        }
                        continue;
                    }
                    let workID = data.id.split("/").pop();

                    Zotero.debug("Work ID:")
                    Zotero.debug(workID)

                    if (!workID) {
                        window.alert("No Work ID found for the selected item. Check the item's DOI or Extra field.");
                        continue;
                    }
                    
                    // Add the Work ID to the 'extra' field
                    let extra = item.getField('extra') || '';
                    if (!extra.includes(`OpenAlex-WorkID:`)) {
                        // Always append the OpenAlex ID line when it is missing.
                        const workIDLine = `OpenAlex-WorkID: ${workID}`;
                        extra = extra ? `${extra}\n${workIDLine}` : workIDLine;
                        item.setField('extra', extra);
                        await item.saveTx(); // Save the changes to the item
                        num_items_added += 1;
                        if (num_items==1) {
                            window.alert("OpenAlex-WorkID added to 'extra' field.");
                        }
                    } else {
                        // Work ID already added
                        if (num_items==1) {
                            window.alert("OpenAlex-WorkID already exists for the selected item, no changes made.");
                        }
                    }
                }
                if (num_items > 1) {
                    window.alert(`Finished adding OpenAlex-WorkIDs to ${num_items} items (${num_items_added} new).`)
                }
            } catch (error) {
                Zotero.debug("Error adding OpenAlex-WorkID:", error);
                window.alert("An error occurred while processing the OpenAlex-WorkID.");
            }
        });
        itemMenuPopup.appendChild(menuItem);

        itemMenuPopup.addEventListener("popupshowing", () => {
            menuItem.hidden = Zotero.getActiveZoteroPane().getSelectedItems().length === 0;
        });
    },

    removeFromWindow(window) {
        let document = window.document;
        let menuItem = document.getElementById("workid-menuitem");
        if (menuItem) menuItem.remove();
    },

    addToAllWindows() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.addToWindow(win);
        }
    },

    removeFromAllWindows() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.removeFromWindow(win);
        }
    },

    async main() {}
};

// Helper function to check if Extra field contains only a DOI
function isDOIOnlyExtra(extra) {
    if (!extra) return false;
    
    const trimmed = extra.trim();
    
    // Check for "DOI: {doi}" format (case insensitive)
    const doiPattern = /^DOI:\s*(.+)$/i;
    const match = trimmed.match(doiPattern);
    
    if (match) {
        const doiValue = match[1].trim();
        return isValidDOI(doiValue);
    }
    
    return false;
}

// Helper function to validate DOI format
function isValidDOI(doi) {
    if (!doi) return false;
    
    // Remove potential https://doi.org/ prefix
    let cleanDOI = doi.replace(/^https?:\/\/doi\.org\//, '');
    
    // DOI pattern: starts with "10." followed by registrant code and suffix
    const doiPattern = /^10\.\d{4,}[\/\.].*$/;
    return doiPattern.test(cleanDOI);
}

// Helper function to extract DOI from Extra field
function extractDOIFromExtra(extra) {
    if (!extra) return null;
    
    const trimmed = extra.trim();
    const doiPattern = /^DOI:\s*(.+)$/i;
    const match = trimmed.match(doiPattern);
    
    if (match) {
        return match[1].trim();
    }
    
    return null;
}

// Updated function to fetch OpenAlex Work ID
async function fetchOpenAlexJSON(item, window) {
    let doi = null;
    
    // First, try to get DOI from the regular DOI field
    doi = item.getField('DOI');
    Zotero.debug("DOI from DOI field:");
    Zotero.debug(doi);
    
    // If no DOI in the regular field, check if Extra field contains only a DOI
    if (!doi) {
        const extra = item.getField('extra') || '';
        Zotero.debug("Extra field content:");
        Zotero.debug(extra);
        
        if (isDOIOnlyExtra(extra)) {
            doi = extractDOIFromExtra(extra);
            Zotero.debug("DOI extracted from Extra field:");
            Zotero.debug(doi);
        }
    }

    if (!doi) {        
        return null;
    }

    // More carefully convert to string and check its value
    doi = String(doi).trim();
    Zotero.debug("DOI after string conversion:");
    Zotero.debug(doi);

    if (!doi) {
        Zotero.debug("DOI is empty after conversion");
        return null;
    }

    // Ensure DOI is in URL format for the API call
    if (doi.startsWith("10")) {
        doi = `https://doi.org/${doi}`;
        Zotero.debug("DOI after URL conversion:");
        Zotero.debug(doi);
    }

    full_api_url = `https://api.openalex.org/works/${doi}`
    Zotero.debug("Full API URL:")
    Zotero.debug(full_api_url)
    
    let response = await fetch(full_api_url);    
    if (response.ok) {
        let data = await response.json();
        Zotero.debug("Data:")
        Zotero.debug(data)        
        return data;
    }
    return null;
}

if (typeof window === 'undefined') {
    this.OpenAlexWorkID = OpenAlexWorkID;
}