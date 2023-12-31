import os
import json
import re

#Find the working directory of the script, then define the relative path from that script
script_dir = os.path.dirname(__file__)
rel_path = r"..\back\Plumsail Forms\MTA Subcontractor Form.json"
relPathOut = "..\data\correctionData.json"

# #Combine the file paths, and read the file into f
fileIn = os.path.join(script_dir, rel_path)
fileOut = os.path.join(script_dir, relPathOut)

#Old testing: I was trying to use regex to find the data instaed of using the key/value pair I am now

# f = open(fileIn, "r", encoding="utf8")

# #Define the regex pattern to be searched:
# regexPattern = r'(?<=\"_internalName\":\").*?[^\",]*'
# #regexPatt = "(?<=\"_internalName\": ).*(?=,
# #pattern = re.compile(r"(?<=\"_internalName\":).*(?=,\n)")
# testString = f.read()

# print(testString)
# foundItems = re.findall(regexPattern, testString)
# print(foundItems)



#A recursive function that should extract every object with the property "_internalName"
#For some reason, does not work with the wizards in OCIPA, B, or COI\
#isinstance returns true if object is a specified type, otherwise false
def extract_data(obj):
    result = []

#If it is a list or a dictionary, keep recursively running this function until you've found an internal name/title/text combo. 
#This doesn't exactly work for all scenerios. For some reasons, OCIPA, B, and COI do not work. I believe that could be due to 
    if isinstance(obj, list):
        for item in obj:
            result.extend(extract_data(item))
    elif isinstance(obj, dict):
        if "_internalName" in obj and "title" in obj and "text" in obj["title"]:
            result.append([obj["_internalName"], obj["title"]["text"]])
        
        for value in obj.values():
            result.extend(extract_data(value))
    
    return result



with open(fileIn, 'r', encoding="utf8") as file:
    data = json.load(file)

#Extract all information from the plumsail form
resultArray = extract_data(data)

GI = {}
SQS = {}
SF = {}
SF1 = {}
RMSA = {}
SB = {}
SB1 = {}
OCIPA = {}
OCIPB = {}
OCIPCOI = {}
MTAForms = {
    "General Information": GI,
    "SQS": SQS,
    "Schedule F": SF,
    "Schedule F1": SF1,
    "Request for Material Supplier Approval": RMSA,
    "Schedule B": SB,
    "Schedule B1": SB1,
    "OCIP Form A": OCIPA,
    "OCIP Form B": OCIPB,
    "OCIP COI": OCIPCOI
}

#Sort the data extracted
for item in resultArray:
    if '.GI.' in item[0]:
        GI[item[1]] = item[0]
    if '.SQS.' in item[0]:
        SQS[item[1]] = item[0]
    if '.SF.' in item[0]:
        SF[item[1]] = item[0]
    if '.SF1.' in item[0]:
        SF1[item[1]] = item[0]
    if '.RMSA.' in item[0]:
        RMSA[item[1]] = item[0]
    if '.SB.' in item[0]:
        SB[item[1]] = item[0]
    if '.SB1.' in item[0]:
        SB1[item[1]] = item[0]
    if '.OCIPA.' in item[0]:
        OCIPA[item[1]] = item[0]
    if '.OCIPB.' in item[0]:
        OCIPB[item[1]] = item[0]
    if '.OCIPCOI.' in item[0]:
        OCIPCOI[item[1]] = item[0]
    
# Combine dictionaries into a single dictionary
data = {
    "MTAForms": MTAForms 
}

# Write data to a JSON file
with open(fileOut, "w") as json_file:
    json.dump(data, json_file, indent=4)