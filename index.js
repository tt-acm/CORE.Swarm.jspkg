const axios = require('axios');

const typeDict = {
  101: "Boolean",
  102: "Point",
  103: "Vector",
  104: "Integer",
  105: "Number",
  106: "Text",
  107: "Line",
  108: "Curve",
  109: "Circle",
  110: "Plane",
  111: "Rectangle",
  112: "Box",
  113: "Surface",
  114: "Brep",
  115: "Mesh",
  116: "Time",
  201: "Slider",
  202: "Boolean Toggle",
  203: "Value List",
  301: "Panel",
  302: "MultilinePanel"
};


// const swarmUrl = "https://dev-swarm.herokuapp.com/api/external";
const swarmUrl = "https://swarm.thorntontomasetti.com/api/external";
// const swarmUrl = "http://localhost:1111/api/external";

class SwarmApp {
  constructor(units, tolerance) {
    this.document = null;
    this.inputValues = [];
    this.appToken = null;
    this.localPort = null;
    this.userId = null;
    this.ssoId = null;
    this.logging = false;
    this.inputs = [];
    this.saveCompute = false;
  }

  // Method
  setDocument(units, tolerance) {
    this.document = {
      tolerance: tolerance,
      units: units
    };
  }

  // setToken(token) {
  //   this.appToken = token;
  // }
  // setProject(proj) {
  //   this.project = proj;
  // }
  //
  // setPlatform(p) {
  //   this.platform = p;
  // }

  compute() {

    return new Promise((resolve, reject) => {
      const startTime = new Date();
      const reqBody = {
        token: this.appToken,
        // inputs: this.inputValues.map(v => v.toObject()),
        inputs: this.inputs.map(inp => inp.toObject()),
        userId: this.userId,
        ssoId: this.ssoId,
        saveThisCompute : this.saveCompute
      }

      let postRoute = swarmUrl + '/compute';
      if (this.localPort != null) postRoute = 'http://localhost:' + this.localPort + '/api/external/compute';

      axios
        .post(postRoute, reqBody)
        .then((res) => {
          const returnedResult = {
            spectaclesElements: res.data.supplemental,
            outputs: []
          }

          if (res.data.values == null) return resolve(null);

          res.data.values.forEach(function (val) {
            let currentOutput = new Output();
            currentOutput.populateOutput(val);
            returnedResult.outputs.push(currentOutput);
          });

          var endTime = new Date();
          const seconds = (endTime.getTime() - startTime.getTime()) / 1000;
          if (this.logging) console.log("SWARM COMPUTE FINISHED AFTER " + seconds + " seconds");

          resolve(returnedResult);
        })
        .catch((error) => {
          console.error(error);
          reject(`Error in callback ${error}`);
        })
    });

  }

  runLongCompute() {
    const startTime = new Date();
    const log = this.logging;

    return new Promise((resolve, reject) => {
      const reqBody = {
        token: this.appToken,
        inputs: this.inputs.map(inp => inp.toObject()),
        userId: this.userId,
        ssoId: this.ssoId,
        saveThisCompute : this.saveCompute
      }
      let postRoute = swarmUrl + '/request-long-compute';
      if (this.localPort != null) postRoute = 'http://localhost:' + this.localPort + '/api/external/request-long-compute';

      // your callback gets executed automatically once the data is received
      var retrieveComputeDataCallback = (computeId, error) => {
        // consume data
        if (error) {
          console.error(error);
          return;
        }


        axios
          .post(swarmUrl + '/get-compute-results', { ...reqBody, ...{_id: computeId}})//appending new compute id to req.body
          .then(async function (res) {
            await sleep(1000);
            // console.log("Retrieved s3 link", res.data);

            if (res.data) retrieveFullComputeFromS3(res.data);
            else reject("Didn't return a signed s3 link");
          })
          .catch((error) => {
            console.error(error);
            reject(`Error in callback ${error}`);
          })
      };

      // Check compute status
      function requestComputeStatus(computeId, callback) {
        axios.post(swarmUrl + '/check-compute-status', {
          ...reqBody,
          ...{mongoId: computeId}
        }).then(async function (response) {
          // request successful
          if (response.data == "Compute Finished!") {
            // console.log("Compute outputs saved to S3!");
            // server done, deliver data to script to consume
            retrieveComputeDataCallback(computeId);
          }
          else {
            await sleep(1000);
            if (log) console.log("retrying...");
            requestComputeStatus(computeId, callback);
          }
        }).catch(error => {
          // ajax error occurred
          // would be better to not retry on 404, 500 and other unrecoverable HTTP errors
          // retry, if any retries left
          console.log("failed, retrying...", error);
          requestComputeStatus(computeId, callback);
        });
      }

      function retrieveFullComputeFromS3(url, callback) {
        axios.get(url).then(res => {
          // console.log("Retrieved response from s3", res.data.values);

          const returnedResult = {
            spectaclesElements: res.data.supplemental,
            outputs: []
          }

          if (res.data.values == null) return resolve(null);

          res.data.values.forEach(function (val) {
            let currentOutput = new Output();
            currentOutput.populateOutput(val);
            returnedResult.outputs.push(currentOutput);
          });

          var endTime = new Date();
          const seconds = (endTime.getTime() - startTime.getTime()) / 1000;
          if (log) console.log("SWARM COMPUTE FINISHED AFTER " + seconds + " seconds");
          resolve(returnedResult);

        }).catch(error => {
          // ajax error occurred
          // would be better to not retry on 404, 500 and other unrecoverable HTTP errors
          // retry, if any retries left
          console.log(error);
        });
      }

      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }


      // Send out long compute
      axios
        .post(postRoute, reqBody)
        .then((res) => {
          if (res.data == null) reject('No compute id was returned');

          requestComputeStatus(res.data, retrieveComputeDataCallback);
        })
        .catch((error) => {
          // console.error(error);
          reject(`Error in callback ${error}`);
        })
    });
  }  
}

class DataTree {
  constructor(type) {
    this.InnerTreeData = {"{ 0; }":[]};
    this.Typecode = type;
  }  
}

class Input {
  constructor(name, type) {
    this.Name = name;
    this.Keys = [];
    this.Typecode = this.findTypeCodeWithName(type);
    this.InnerTree = new DataTree(this.findTypeCodeWithName(type));
  }

  toObject() {
    return {
      ParamName: "SWRM_IN:" + this.Typecode + ":" + this.Name,
      Keys: Object.keys(this.InnerTree.InnerTreeData),
      InnerTree: this.InnerTree.InnerTreeData,
      Count: this.Keys.length,
      IsReadOnly: false
    }
  }

  findTypeCodeWithName(typeName) {
    const typeIndex = Object.values(typeDict).indexOf(typeName);
    if (typeIndex > -1) return Object.keys(typeDict)[typeIndex];
    else return null;
  }

  addDataTree(branchIndex, data) {
    // console.log("ADD DATA TREE", branchIndex, data, this.Typecode);
    if (branchIndex == null || !Number.isInteger(branchIndex)) return console.log("Branch index have to be an integer");
    if (data == null) return console.log("Invalid data");

    if (!Array.isArray(data)) data = [data]; // Forcing incoming data to be an array;
    let convertedData = data.map(d => formatInputValNew(d, this.Typecode));

    const curBranchIndex = Object.keys(this.InnerTree.InnerTreeData)[0].replace("0", branchIndex);

    if (this.InnerTree.InnerTreeData[curBranchIndex] != null) {
      // if this branch has existing data, append
      this.InnerTree.InnerTreeData[curBranchIndex] = this.InnerTree.InnerTreeData[curBranchIndex].concat(convertedData);
    }
    else this.InnerTree.InnerTreeData[curBranchIndex] = convertedData;
  }

  addData(data) {
    this.addDataTree(0, data);
  }  
}

class Output {
  constructor() {
    this.name = null;
    this.branches = [];
    this.attribute = {};
    this.outputValue = {};
  }

  populateOutput(returnedOutput) {
    this.name = returnedOutput.ParamName;
    this.branches = Object.keys(returnedOutput.InnerTree) ? Object.keys(returnedOutput.InnerTree) : [];
    if (this.name.split(':').length < 2) return;

    const typecode = this.name.split(':')[1];


    this.branches.forEach(b => {
      this.attribute[b] = returnedOutput.InnerTree[b].map(data => data.attributes);
      this.outputValue[b] = returnedOutput.InnerTree[b].map(function (d) {
        // loop throuhg each item in this branch
        if (d == null || typeof d === 'undefined') return;
        let curVal = getOutputValue(d, typecode);
        return curVal;
      })
    })

    function getOutputValue(valueArray, typecode) {
      if (typecode == 106) // text
      {
        //output.Text = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
        return valueArray.length === 0 ? null : JSON.parse(valueArray.data);
      } else if (typecode == 301 || typecode == 302) // multiline panel
      {
        var concat = valueArray.map(val => {
          return JSON.parse(val.data);
        });

        return concat.join(",");
      } else if (typecode == 104 || typecode == 105 || typecode == 201) // integer and Number || Slider
      {
        return valueArray.length === 0 ? null : JSON.parse(valueArray.data);
        // this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
        //output.Value = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data)
      }
      else if (typecode == 101 || typecode == 202) // boolean || boolean Togle
      {
        return valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
        //output.State = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data == "true");
      }
      else if (typecode == 116) // time
      {
        return valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
        //output.SelectedDateTime = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
      }
      else if (typecode == 305) // url
      {
        return valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
        //output.Url = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
        // } else if (output.hasOwnProperty('ReferencedGeometry')) {
        //   this.outputValue = valueArray;
        //output.ReferencedGeometry = swarmOutput.InnerTree['{ 0; }'];
      }
      else // everything else
      {
        return valueArray !== undefined ? valueArray : null;
      }

      // this.attribute = valueArray !== undefined && valueArray.length != 0 ? valueArray[0].attributes : null;
    }
  }

  getDataTree(branchIndex) {
    if (branchIndex == null || !Number.isInteger(branchIndex)) return console.log("Branch index have to be an integer");

    if (branchIndex > this.branches.length - 1) return console.log("Cannot retrieve output data using specified branch index, index out of range.");

    return this.outputValue[this.branches[branchIndex]];
  }

};


function formatInputValNew(inp, typecode) {
  // var tree = [];
  var swarmObj = {};
  // toSwarmTree
  if (typecode == 106 || typecode == 301 || typecode == 302) { // Text
    swarmObj.type = "System.String";
    swarmObj.data = `\"` + inp + `\"`;
    // tree.push(swarmObj);
  } else if (typecode == 105 || typecode == 201) { // Number and Slider
    swarmObj.type = "System.Double";
    swarmObj.data = inp;
    // tree.push(swarmObj);
  } else if (typecode == 104) { // Integer
    swarmObj.type = "System.Int32";
    swarmObj.data = inp;
    // tree.push(swarmObj);
  } else if (typecode == 101 || typecode == 202) { // Boolean or Boolean Toogle
    swarmObj.type = "System.Boolean";
    //console.log("in.State", in.State);
    swarmObj.data = `\"` + inp + `\"`;
    // tree.push(swarmObj);
  } else if (typecode == 116) { // Time
    swarmObj.type = "System.DateTime";
    swarmObj.data = `\"` + inp + `\"`;
    // tree.push(swarmObj);
  } else if (typecode == 203) { // Value List
    swarmObj.type = "System.String";
    // var selected = inp.find(v => v.Key == inp.Key);
    swarmObj.data = JSON.stringify(inp);
    // tree.push(swarmObj);
  } else if (typecode == 102) { // Points
    const currentGeo = {
      type: "Rhino.Geometry.Point3d",
      data: JSON.stringify(inp),
      attributes: {
        "Name": null,
        "LayerName": null,
        "LayerIndex": -1,
        "UserDictionary": {},
        "DisplayColor": ""
      }
    };
    // console.log("currentGeo", currentGeo);
    // console.log("point element", element);
    swarmObj = currentGeo;

    // tree.push(currentGeo);
  } else if (typecode == 108) { // Curves
    const currentGeo = {
      type: "Rhino.Geometry.NurbsCurve",
      data: JSON.stringify(inp),
      attributes: {
        "Name": null,
        "LayerName": null,
        "LayerIndex": -1,
        "UserDictionary": (inp) ? inp : {},
        "DisplayColor": ""
      }
    };
    //console.log("currentGeo", currentGeo);
    swarmObj = currentGeo;

    // tree.push(currentGeo);
  } else if (typecode == 114) { // Brep
    const currentGeo = {
      type: "Rhino.Geometry.Brep",
      data: JSON.stringify(inp),
      attributes: {
        "Name": null,
        "LayerName": null,
        "LayerIndex": -1,
        "UserDictionary": (inp) ? inp : {},
        "DisplayColor": ""
      }
    };
    swarmObj = currentGeo;

    // tree.push(currentGeo);
  } else if (typecode == 115) { // Mesh
    const currentGeo = {
      type: "Rhino.Geometry.Mesh",
      data: JSON.stringify(inp),
      attributes: {
        "Name": null,
        "LayerName": null,
        "LayerIndex": -1,
        "UserDictionary": (inp) ? inp : {},
        "DisplayColor": ""
      }
    };
    swarmObj = currentGeo;

    // tree.push(currentGeo);
  } else if (typecode == 306) {
    console.log("TODO not sure how swarm object ", inp);
    swarmObj.type = "System.Object";
    swarmObj.data = JSON.stringify(inp);
    // tree.push(swarmObj);
  } else if (input.hasOwnProperty('ReferencedGeometry')) {
    if (input.ReferencedGeometry != undefined && input.ReferencedGeometry.length > 0) {
      input.ReferencedGeometry.forEach(element => {
        // tree.push(element);
      });
    }
  } else {
    console.log("TODO new type ? ", input.type);
  }

  return swarmObj;
}



// module.exports = SwarmApp;
module.exports = {SwarmApp, Input, DataTree};
