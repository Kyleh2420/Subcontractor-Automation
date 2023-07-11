/*******************************************************************************************************
* The code from this section is executed once the form is loaded.                                      *
*                                                                                                      *
* Depending on the stage of the form lifecycle when a particular action should be performed,           *
* you can use on the following hooks:                                                                  *
*                                                                                                      *
* fd.rendered()     the code is executed once the form is rendered                                     *
*                                                                                                      *
* fd.beforeSave()   the code is executed right before saving the form. If returns Promise, the saving  *
*                   does not proceed until the Promise is resoved. If the Promise is rejected,         * 
*                   the saving interrupts. This is the appropriate place for adding custom validation. *
*                                                                                                      *
* fd.saved()        the code is executed once the form is submitted                                    *
*                                                                                                      *
*
*   The following events are possible:
*       fd.beforeCreate()
*       fd.created()
*       fd.beforeRender()
*       fd.rendered()
*       fd.beforeSave()
*       fd.saved()
*
*
* The following predefined variables can be utilized in the code:                                      *
*                                                                                                      *
* fd    an instance of the current form                                                                *
* $     jQuery object                                                                                  *
*                                                                                                      *
*******************************************************************************************************/

// ================================================================
//  EXAMPLE 1: The code is executed right after rendering the form 
// ================================================================
fd.rendered(function () {
    
    //Functions that run initially
    executeOnce();

    //Items that change on action
    onActionFields = ['sc.SQS.3.corpOrCoPartner', 
    'sc.SB1.isSB1Required',
    'sc.SF.FF3.3.reportType',
    'sc.SB.isSBRequired',
    'sc.SF.FF3.FF3Applicable',
    'sc.RMSA.isRequired'];
    onActionControl = ['InsurancePremium'];

    onActionFields.forEach(field => fd.field(field).$on('change',toggleFields));
    onActionControl.forEach(control => fd.control(control).$on('change', updateControls));
});

fd.beforeSave(function () {
    url = "https://prod-102.westus.logic.azure.com:443/workflows/1128de5c7a7e488e9e88a34f00eb974b/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B_VCWVNlWNAnOJfI9ytYCVZGVLNLkvYBq2iMluENAI0";
    data = fd.data();
    fetchJSONData(data, url)
});

var executeOnce = (function() {
    var executed = false;
    return function() {
        if (!executed) {
            executed = true;
            autoPopulateGenInfo();
            toggleFields();
            disableFields();
            updateControls();
        }
    };
})();
 
function updateControls() {
    fd.control("InsurancePremium").$on('change', function(value){
    //Autopopulates the premium row in OCIP B Section II
    if (value) { //If there are records in the table
        for (var i = 0; i < value.length; i++) {
            value[i].set('premium', value[i].payroll * value[i].wCRate / 100);
        }
    }
    var workHours = 0;
    var estPayroll = 0;
    var premium = 0;
    //Autopopulates the totals below the data table
    if (value) {
        for (var i = 0; i < value.length; i++) {
            workHours += value[i].workHours;
            estPayroll += value[i].payroll;
            premium += value[i].premium;
        }
    }

    fd.field("WorkHoursTotal").value = workHours;
    fd.field("EstimatedLimitedPayrollTotal").value = estPayroll;
    fd.field("PremiumTotal").value = premium;
});
}


/*
    This function will parse the query in the URL, then pass this information into a function that returns a promise
    to the contents of some JSON file.
*/
function externalFile() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    contractNumber = urlParams.get('contract');
    subcontractorName = urlParams.get('subName');
    let infoToSend = {
        "Contract": contractNumber,
        "subName": subcontractorName
    }
    
    const url = "https://prod-73.westus.logic.azure.com:443/workflows/9f7be33c84d844ecadd0baaef7cd1a7e/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=faXNcybrgh-3IH3KD7V7wloZaKsSEshlye4N9siJdNw";
    return fetchJSONData(infoToSend, url)
    .then(json => {
        console.log(json);
        return json
    });
}

/*
    This function will call upon our makeshift API to retrieve a promise of data that should be autofilled.
*/
function fetchJSONData(contract, url) {
    const headers = {
      'Content-Type': 'application/json'
    };
  
    const options = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(contract)
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
  }

/*
This bit of code controls the autofill behavior. First, we will look for an arry in the JSON
called "EditableItems". This indicates the autofilled items that should be editable. Otherwise, autofilled items
are not editable. Anything not mentioned is not named".
*/
function autoPopulateGenInfo() {
    //3 step process
    //Clear all items: nothing can be saved in memory
    //Read the external JSON file and autofill all items
    //Extract editable fields
    //Loop through each field and control in the form. If the item has a value or is not on the "editable items" list, disable
    fd.clear();
    //Any un-autofilled code should be editable. Thus, we reset before disabling.
    fd.fields().forEach(el => {
        fd.field(el.internalName).disabled = false;
    });

    //Extract the items that should be editable
    externalFile().then(function(data){
        fd.data(data);

        let editable = [];
        try{const {EditableItems: editableItems} = data;
            if (editableItems !== undefined) {
                editable = editableItems;
            }
        }
        catch(err) {
            console.log("There is nothing editable in this document");
        }

        //There are fields with different elements. If a text or note is unfilled, it is simply null
        //When a single choice or multiple hcoice is empty, it is "". Thus, we must isolate these by internal name first
        //Text internal name: t.
        //Note: n.
        //Radial Internal Name: sc
        //Drop Down: dd
        //masked text: mt
        //date: d.
        //num: nu
        //If the respective values are filled, and they don't need to be edited, then they're set to disabled

        fd.fields().forEach(el => {
            try {
                let internalName = el.internalName;
                if (!editable.includes(el.internalName)) {
                    switch(internalName.substr(0, 2)) {
                        case "sc":
                            if(fd.field(el.internalName).value !== "") {
                                fd.field(el.internalName).disabled = true;
                            }
                            break;
                        case "t.":
                        case "dd":
                        case "mt":
                        case "d.":
                        case "nu":
                        case "n.":
                            if(fd.field(el.internalName).value !== null) {
                                fd.field(el.internalName).disabled = true;
                            }
                            break;
                        default:
                            fd.field(el.internalName).disabled = false;
                    }
                }
            } catch (err) {

            }

        });

        //There are controls with no values, such as buttons, text, hml elements, etc
        //We have formatted all data tables starting with dt. We must first isolate this.
        //Then, we check if there is anything in the data table. If there is nothing, we should not disable the field.
        //We will also check if it needs to be edited
        fd.controls().forEach(el => {
            try{
                let internalName = el.internalName;
                if(internalName.substr(0, 2) === 'dt' && fd.control(el.internalName).value.length > 0 && !editable.includes(el.internalName)) {
                    fd.control(el.internalName).disabled = true;
                }
            } catch (err) {
                console.log(err);
            }

        });
    })

    
}
/*
    This function will toggle all the disappearing/conditional fields and update every them every time 
    it is called. When called, it will attempt to hide/show fields that correspond to the css class.

*/


function disableFields() {
    // make Unit Price column read-only
    const premiumColumn = fd.control("InsurancePremium").columns.find(c => c.field === 'premium');
    premiumColumn.editable = () => false;
    fd.field("WorkHoursTotal").disabled = true;
    fd.field("EstimatedLimitedPayrollTotal").disabled = true;
    fd.field("PremiumTotal").disabled = true;
}

//To be more efficient (And not run everything all at once) turn this function into an object
//And call upong specific portions in the object
function toggleFields() {
    var formFields = fd.fields();
    var formControl = fd.controls();

    //Toggles the SQS Form
    if (fd.field('sc.SQS.3.corpOrCoPartner').value === 'Corporation'){
        $('.SQSCorporation').show();
        $('.SQSCoPartnership').hide();

        //https://community.plumsail.com/t/disable-all-fields-in-a-grid-container/10249/2
        formFields.forEach(field => {
            if (field.$el.closest('.SQSCorporation') != null) {
                field.required = true;
            }
            if (field.$el.closest('.SQSCoPartnership') != null) {
                field.required = false;
            }
        })

        formControl.forEach(control => {
            if (control.$el.closest('.SQSCorporation') != null) {
                control.required = true;
            }
            if (control.$el.closest('.SQSCoPartnership') != null) {
                control.required = false;
            }
        })

    } else if (fd.field('sc.SQS.3.corpOrCoPartner').value === 'Co-partnership') {
        $('.SQSCorporation').hide();
        $('.SQSCoPartnership').show();

        formFields.forEach(field => {
            if (field.$el.closest('.SQSCorporation') != null) {
                field.required = false;
            }
            if (field.$el.closest('.SQSCoPartnership') != null) {
                field.required = true;
            }
        })

        formControl.forEach(control => {
            if (control.$el.closest('.SQSCorporation') != null) {
                control.required = false;
            }
            if (control.$el.closest('.SQSCoPartnership') != null) {
                control.required = true;
            }
        })

    } else {
        $('.SQSCorporation').hide();
        $('.SQSCoPartnership').hide();

        formFields.forEach(field => {
            if (field.$el.closest('.SQSCorporation') != null) {
                field.required = false;
            }
            if (field.$el.closest('.SQSCoPartnership') != null) {
                field.required = false;
            }
        })
        formControl.forEach(control => {
            if (control.$el.closest('.SQSCorporation') != null) {
                control.required = false;
            }
            if (control.$el.closest('.SQSCoPartnership') != null) {
                control.required = false;
            }
        })
        
    }

    //Toggles Schedule F, Form F3
    if (fd.field('sc.SF.FF3.FF3Applicable').value === 'Not Applicable'){
        $('.ScheduleFFormF3').hide();
    } else {
        $('.ScheduleFFormF3').show();
    }
    toggleReq(formFields, "ScheduleFFormF3");

    //Toggles Schedule B
    if(fd.field('sc.SB.isSBRequired').value === 'Yes'){
        $('.ScheduleBClass').show();
    } else{
        $('.ScheduleBClass').hide();
    }
    toggleReq(formFields, "ScheduleBClass");

    //Toggles Schedule B1
    if(fd.field('sc.SB1.isSB1Required').value === 'I need to fill out Schedule B1'){
        $('.ScheduleB1Class').show();
    } else{
        $('.ScheduleB1Class').hide();
    }
    toggleReq(formFields, "ScheduleB1Class");

    //Toggles F3 Materials List
    if(fd.field('sc.SF.FF3.FF3Applicable').value === 'b. Material Change') {
        $('.ScheduleF3MaterialChange').show();
    } else{
        $('.ScheduleF3MaterialChange').hide();
    }

    //Toggles the visibiliy and requirement of the RMSA form
    if(fd.field('sc.RMSA.isRequired').value === 'Yes') {
        $('.RMSAControl').show();
    } else {
        $('.RMSAControl').hide();
    }
    toggleReq(formFields, "RMSAControl");
}
//This function assists in removing the required for all fields inside a given list
function toggleReq(list, name) {
    list.forEach(field => {
        if (field.$el.closest("." + name) != null) {
            field.required = !field.required;
        }
    })
}