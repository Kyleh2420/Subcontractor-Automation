/*
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|                         fd.rendered gets run once the form is completely rendered.                          |
|                    The functions inside are responsible for updating what the user sees                     |
|                                          upon something updating.                                           |
|                                                                                                             |
|        $on('edit'...) will change the dropdowns on formName and itemToChange upon clicking the dropdowns.         |
|                                                                                                             |
|$on('change'...) will update the rightmost column with the internal name once the dropdown has been selected.|
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
*/
fd.rendered(function() {
    fd.clear();
    dataTableFunctions.disableLastColumn();
    dataHandling.externalFile();
    
    

    /*
    data = {}
    externalFile().then(function (jsonData) {
        data = jsonData;
    })
    */

    //At the same time, set up the event listeners for the dropdown values to change its values whenever the user clicks it.
    (async () => {
        const value = await dataHandling.getContracts();
        //console.log(value);
        fd.field('dd.GI.contractNo').widget.dataSource.data(value);
    })();

    fd.field('dd.GI.contractNo').$on('change', function(value) {
        (async () => {
            const value = await dataHandling.getSubcontractors();
            //console.log(value);
            fd.field('dd.GI.subcontractorName').widget.dataSource.data(value);
        })();
    })

});

/*
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|                     Before saving, we need to check to make sure nothing is missing from the form.                      |
|                   That is: there are no "undefined"s in column 3, where the internal name should be.                    |
|                         If that function fails, throw an error and disallow the user to submit.                         |
|                                                                                                                         |
|      Once we know that the form is good to go, we need to compose the JSON to be sent to the Power Automate step.       |
|                                                                                                                         |
|                             Power Automate expects the 5 essential pieces of information.                               |
|                                                  1. Subcontractor Name                                                  |
|                                                   2. Contract Number                                                    |
|3. Body of email (An array of the specified changes, to be added to the email) [It was simpler in JS than Power Automate]|
|      4. editableItems (An array of internal names that should be edited. This will be inserted into the JSON file)      |
|                        5. email (An array of emails addresses whom the email should be sent to)                         |
|                                                                                                                         |
+-------------------------------------------------------------------------------------------------------------------------+
*/
fd.beforeSave(function() {
    if (dataTableFunctions.checkitemInternalNameFIlled()) {
        console.log(dataTableFunctions.checkitemInternalNameFIlled());
        throw new Error("Your form is not completed - there are still missing components");
    }
    
    dataHandling.submitData();
});

let dataHandling = {
    getURL: "https://prod-39.westus.logic.azure.com:443/workflows/e79e3cfdbbed4570a579427a6472f6a7/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ynEJekS_a33ZhHDPGbDNNUqVqMPjcqk90FZgdp-HmLo",
    submitURL: "https://prod-76.westus.logic.azure.com:443/workflows/34545c436ff04f18a535e11258c53ad7/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QaY6UKMxwRLFyre2HKECVA9N8c_3k2WYfX5ZuYYngrg",
    //getContracts returns an array of the "titles" of all the folders given via a power automate HTTPS flow
    getContracts: function() {
        contractNumbers = [];
        dataToSend = {
            "getContractNum": "true",
            "getSubcontractors": ""
        }
        return this.interactWithAPI(dataToSend, this.getURL).then(data => {
            data.forEach(el => {
                //Old Method
                //If the title is defined, note it down to return as an array.
                // if (el.Title !== undefined) {
                //     contractNumbers.push(el.Title);
                // }

                //New Method
                //If {IsFolder} is true, then we can notate the value {Name} as the name of the folder
                if (el['{IsFolder}'] == true) {
                    contractNumbers.push(el['{Name}']);
                }
            });
            return contractNumbers;
        })
        .catch(error => {
            console.error(error);
            return [];
        })
    },

    getSubcontractors: function() {
        subcontractorNames = [];
        dataToSend = {
            "getContractNum": "false",
            "getSubcontractors": "R-33333"
        }
        dataToSend.getSubcontractors = fd.field("dd.GI.contractNo").value;
        return this.interactWithAPI(dataToSend, this.getURL).then(data => {
            console.log(data);
            data.forEach(el => {
                if (el["{Name}"] !== undefined && el["{Name}"] !== fd.field("dd.GI.contractNo").value) {
                    subcontractorNames.push(el["{Name}"]);
                    //console.log(el["{Name}"]);
                }
            });
            return subcontractorNames;
        })
        .catch(error => {
            console.error(error);
            return [];
        })

    },
    //Because I wanted to process the majority of this in JS and not PA, we have this mess
    submitData: function() {
        formData = fd.data();
        dataToSend = {};
        console.log(dataToSend);
        dataToSend = formData;

        //I forgot to rename the first datatable, so it is now known as "DataTable1"
        formToCorrect = dataTableFunctions.extractData("DataTable1", "formName");
        questionsToCorrect = dataTableFunctions.extractData("DataTable1", "itemToChange");
    
        bodyOfEmail = [];
        emptyString = "";
        for (var i = 0; i < formToCorrect.length; i++) {
            bodyOfEmail.push(formToCorrect[i].concat(' - ',questionsToCorrect[i]));
            //console.log(bodyOfEmail);
        }
        dataToSend.bodyOfEmail = bodyOfEmail;
        dataToSend.editableItems = dataTableFunctions.extractData("DataTable1", "itemInternalName");
        
        
        dataToSend.email = dataTableFunctions.extractData("dt.email", "Email");
        console.log(dataToSend);
        
        this.interactWithAPI(dataToSend, this.submitURL);
        //throw new Error("Preventing you from submitting");
    },
    /*
    +-------------------------------------------------------------------------------------------+
    |                                                                                           |
    |      This function will send the data provided to the url provided as POST request.       |
    |I chose POST over GET since a body with information could be included at all times in POST.|
    |                                                                                           |
    +-------------------------------------------------------------------------------------------+
    */
    interactWithAPI: function(data, url) {
        const headers = {
        'Content-Type': 'application/json'
        };
    
        const options = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
        };
    
        return fetch(url, options)
        .then(response => {
            if (response.ok) {
            return response.json();
            } else {
            throw new Error('Error: ' + response.status);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    },
    externalFile: async function() {
        urlOfJSON = "https://tce-innovation.github.io/Subcontractor-Automation/data/correctionData.json";
        fetch(urlOfJSON).then (response => {
            if (!response.ok) {
                throw new Error (`Network response was not ok: ${response.status}`);
            }
            return response.json();
        }).then(jsonData => {
            //Everytime the datatable is edited, it will update the drop downs with the correct infomration
            fd.control('DataTable1').$on('edit', function(e) {
                //console.log(e);
                if (e.column.field === 'formName') {
                    dataTableFunctions.populateColumn(e.widget, e.model.formName, jsonData.MTAForms);
                }
                if (e.column.field === 'itemToChange') {
                    dataTableFunctions.populateColumn(e.widget, e.model.itemToChange, jsonData.MTAForms[e.model.formName]);
                }
            });
            
            //Everytime the datatable is edited, it will update the third dropdwon 
            fd.control('DataTable1').$on('change', function(value) {
                for (var i = 0; i < value.length; i++) {
                    //console.log(value);
                    try{
                    value[i].set('itemInternalName', jsonData.MTAForms[value[i].formName][value[i].itemToChange]); 
                    } catch {
                        console.log(jsonData.MTAForms[value[i].formName]);
                    }
                }
                console.log(dataTableFunctions.checkitemInternalNameFIlled());
            });
        })
        .catch(error => {
            console.error("Error fetching the JSON data:", error);
        });
    }
}







let dataTableFunctions = {

    /*
    +--------------------------------------------------------------------------------------------------------+
    |                                                                                                        |
    |                 This function, dataTableFunctions.checkitemInternalNameFIlled(), iterates through the data table                   |
    |"DataTable1" and counts the number of rows where the value in "itemInternalName" is undefined (i.e., not filled).|
    |                                                                                                        |
    |                 returns {number} The count of rows with undefined values in "itemInternalName".                 |
    |                                                                                                        |
    |                                                                                                        |
    +--------------------------------------------------------------------------------------------------------+
    */
    checkitemInternalNameFIlled: function() {
        //This function should loop through the data table and return 1 if the column something is undefined (ie. not filled)
        //Thus, lets count the number of undefineds. If it exceeds 1, then we have an empty row, and we should return the number of undefineds. Otherwise, return 0
        var i = 0;
        fd.control("DataTable1").value.forEach(row => {
            if (row.itemInternalName === undefined) {
                i++;
            }
        });
        return i;
    },

    /*
    +---------------------------------------------------------------------------------------------------------------+
    |                                                                                                               |
    |This helper function, dataTableFunctions.populateColumn(), is designed to populate the dropdown of a specific cell in a datatable.|
    |                                                                                                               |
    |                    @param {any} widget - The widget (dropdown) to be populated with data.                     |
    |                                                                                                               |
    |           @param {any} value - The value to be selected in the dropdown (if it exists in the data).           |
    |                                                                                                               |
    |          @param {Array} arrayName - The array containing the data to populate the dropdown options.           |
    |                                                                                                               |
    |                           @returns {void} This function does not return any value.                            |
    |                                                                                                               |
    +---------------------------------------------------------------------------------------------------------------+
    */
    populateColumn: function(widget, value, arrayName) {
        widget.setDataSource({
            data: Object.keys(arrayName)
        });
        widget.value(value);
    },

    /*
    +-------------------------------------------------------------------------------------+
    |                                                                                     |
    |               This function, disableLastColumn(), is used to disable                |
    |the editing capability of the last column ('itemInternalName') in the data table "DataTable1".|
    |                                                                                     |
    |              @returns {void} This function does not return any value.               |
    |                                                                                     |
    +-------------------------------------------------------------------------------------+
    */
    disableLastColumn: function() {
        const premiumColumn = fd.control("DataTable1").columns.find(c => c.field === 'itemInternalName');
        premiumColumn.editable = () => false;
    },

    /*
    +-----------------------------------------------------------------------------------------------+
    |                                                                                               |
    |This function will extract all the values in a column in a data table and return it as an array|
    |                                                                                               |
    +-----------------------------------------------------------------------------------------------+
    */
    extractData: function(dt, col) {
        returnArray = [];
        
        fd.control(dt).value.forEach(row => {
            returnArray.push(row[col]);
        });
        return returnArray;
    }
}