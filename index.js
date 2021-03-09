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

// cost swarmUrl = "https://dev-swarm.herokuapp.com/api/external";
const swarmUrl = "https://swarm.thorntontomasetti.com/api/external";

class SwarmApp {
  constructor(units, tolerance) {
    this.document = null;
    this.inputValues = [];
    this.appToken = null;
    this.localPort = null;
    this.userId = null;
    this.startTime = new Date();
    this.logging = false;
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
      const reqBody = {
        token: this.appToken,
        inputs: this.inputValues.map(v => v.toObject()),
        userId: this.userId
      }
      let postRoute = swarmUrl + '/compute';
      if (this.localPort != null) postRoute = 'http://localhost:' + this.localPort + '/api/external/compute';

      axios
        .post(postRoute, reqBody)
        .then((res) => {
          //console.log("res.data.values.InnerTree", res.data.values[0].InnerTree);
          const returnedResult = {
            spectaclesElements : res.data.supplemental,
            outputList: []
          }

          if (res.data.values == null) return resolve(null);

          res.data.values.forEach(function (val) {
            let currentOutput = new Output(val);
            var valueArray = Object.values(val.InnerTree)[0];
            if (valueArray != null) {
              currentOutput.setOutputValue(valueArray)
              returnedResult.outputList.push(currentOutput);
            }            
          });

          const elapsedTime = new Date() - this.startTime;
          if (this.logging) console.log("SWARM COMPUTE FINISHED AFTER " + elapsedTime/1000 + " seconds");

          resolve(returnedResult);
        })
        .catch((error) => {
          console.error(error);
          reject(`Error in callback ${error}`);
        })
    });

  }

  runLongCompute() {
    const startTime = this.startTime;
    const log = this.logging;
    return new Promise((resolve, reject) => {
      const reqBody = {
        token: this.appToken,
        inputs: this.inputValues.map(v => v.toObject()),
        userId: this.userId
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
        // console.log("Retrieving compute from id: ",computeId);

        // return new Promise((resolve, reject) => {});

        axios
        .post(swarmUrl + '/get-compute-results', {_id: computeId, token: reqBody.token})
        .then(async function(res) {
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
          mongoId:computeId,
          token: reqBody.token
        }).then(async function(response) {
            // request successful
            if(response.data == "Compute Finished!") {
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
          // console.log("Retrieved response from s3");

          const returnedResult = {
            spectaclesElements : res.data.supplemental,
            outputList: []
          }

          if (res.data.values == null) return resolve(null);

          res.data.values.forEach(function (val) {
            let currentOutput = new Output(val);
            var valueArray = Object.values(val.InnerTree)[0];
            if (valueArray != null) {
              currentOutput.setOutputValue(valueArray)
              returnedResult.outputList.push(currentOutput);
            }            
          });

          const elapsedTime = new Date() - startTime;
          if (log) console.log("SWARM COMPUTE FINISHED AFTER " + elapsedTime/1000 + " seconds");
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

  findTypeCodeWithName(typeName) {
    const typeIndex = Object.values(typeDict).indexOf(typeName);
    if (typeIndex > -1) return Object.keys(typeDict)[typeIndex];
    else return null;
  }

  addInput(input) {
    // const newInput = {
    //   Keys: ["{ 0; }"],
    //   InnerTree: {}
    // };
    const typecode = this.findTypeCodeWithName(input.type);
    const paramName = "SWRM_IN:" + typecode + ":" + input.name;
    let newInput = new Input(paramName);

    input.values.forEach(function (inp) {
      var tree = [];
      var swarmObj = {};
      // toSwarmTree
      if (typecode == 106 || typecode == 301 || typecode == 302) { // Text
        swarmObj.type = "System.String";
        swarmObj.data = `\"` + inp.Text + `\"`;
        tree.push(swarmObj);
      } else if (typecode == 105 || typecode == 201) { // Number and Slider
        swarmObj.type = "System.Double";
        swarmObj.data = inp.Value;
        tree.push(swarmObj);
      } else if (typecode == 104) { // Integer
        swarmObj.type = "System.Int32";
        swarmObj.data = inp.Value;
        tree.push(swarmObj);
      } else if (typecode == 101 || typecode == 202) { // Boolean or Boolean Toogle
        swarmObj.type = "System.Boolean";
        //console.log("in.State", in.State);
        swarmObj.data = `\"` + inp.State + `\"`;
        tree.push(swarmObj);
      } else if (typecode == 116) { // Time
        swarmObj.type = "System.DateTime";
        swarmObj.data = `\"` + inp.SelectedDateTime + `\"`;
        tree.push(swarmObj);
      } else if (typecode == 203) { // Value List
        swarmObj.type = "System.String";
        var selected = inp.Values.find(v => v.Key == inp.Key);
        swarmObj.data = JSON.stringify(selected.Value);
        tree.push(swarmObj);
      } else if (typecode == 102) { // Points
        const currentGeo = {
          type: "Rhino.Geometry.Point3d",
          data: JSON.stringify(inp.Value),
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

        tree.push(currentGeo);
      } else if (typecode == 108) { // Curves
        const currentGeo = {
          type: "Rhino.Geometry.NurbsCurve",
          data: JSON.stringify(inp.Value),
          attributes: {
            "Name": null,
            "LayerName": null,
            "LayerIndex": -1,
            "UserDictionary": (inp.customAttributes) ? inp.customAttributes : {},
            "DisplayColor": ""
          }
        };
        //console.log("currentGeo", currentGeo);

        tree.push(currentGeo);
      } else if (typecode == 114) { // Brep
        const currentGeo = {
          type: "Rhino.Geometry.Brep",
          data: JSON.stringify(inp.Value),
          attributes: {
            "Name": null,
            "LayerName": null,
            "LayerIndex": -1,
            "UserDictionary": (inp.customAttributes) ? inp.customAttributes : {},
            "DisplayColor": ""
          }
        };

        tree.push(currentGeo);
      } else if (typecode == 115) { // Mesh
        const currentGeo = {
          type: "Rhino.Geometry.Mesh",
          data: JSON.stringify(inp.Value),
          attributes: {
            "Name": null,
            "LayerName": null,
            "LayerIndex": -1,
            "UserDictionary": (inp.customAttributes) ? inp.customAttributes : {},
            "DisplayColor": ""
          }
        };

        tree.push(currentGeo);
      } else if (typecode == 306) {
        console.log("TODO not sure how swarm object ", inp);
        swarmObj.type = "System.Object";
        swarmObj.data = JSON.stringify(inp.Lines);
        tree.push(swarmObj);
      } else if (input.hasOwnProperty('ReferencedGeometry')) {
        if (input.ReferencedGeometry != undefined && input.ReferencedGeometry.length > 0) {
          input.ReferencedGeometry.forEach(element => {
            tree.push(element);
          });
        }
      } else {
        console.log("TODO new type ? ", input.type);
      }

      // tree.attributes = {
      //   "Name": null,
      //   "LayerName": null,
      //   "LayerIndex": -1,
      //   "UserDictionary": {},
      //   "DisplayColor": ""
      // }

      //console.log("tree", tree);

      newInput.InnerTree["{ 0; }"] = tree;

      newInput.Keys = ["{ 0; }"];
      newInput.Values = tree;
    });

    this.inputValues.push(newInput);
  }
}

class Input {
  constructor(name) {
    this.name = name;
    this.Keys = ["{ 0; }"];
    this.InnerTree = {};
    this.Values = null;
  }

  toObject() {
    return {
      ParamName: this.name,
      Keys: this.Keys,
      InnerTree: this.InnerTree,
      Values: this.Values,
      Count: this.Values.length,
      IsReadOnly: false
    }
  }
}

class Output {
  constructor(output) {
    this.name = output.ParamName;
    this.branchIndex = Object.values(output.InnerTree)? Object.values(output.InnerTree)[0]: null;
    if (this.branchIndex && output.InnerTree[this.branchIndex]) this.attribute = output.InnerTree[this.branchIndex].attributes;
    this.outputValue = null
  }

  setOutputValue(valueArray) {
    // var valueArray = Object.values(swarmOutput.InnerTree)[0];
    if(valueArray === undefined || valueArray == null) return;
    
    if (this.name.split(':').length < 2) return;

    let typecode = this.name.split(':')[1];

    // console.log("typecode", typecode);

    //console.log("typecode", typecode);
    if (typecode == 106) // text
    {
      //output.Text = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
      this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
    } else if (typecode == 301 || typecode == 302) // multiline panel
    {
      var concat = valueArray.map(val => {
        return JSON.parse(val.data);
      });

      this.outputValue = concat.join(",");
    } else if (typecode == 104 || typecode == 105 || typecode == 201) // integer and Number || Slider
    {
      this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
      //output.Value = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data)
    }
    else if (typecode == 101 || typecode == 202) // boolean || boolean Togle
    {
      this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
      //output.State = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data == "true");
    }
    else if (typecode == 116) // time
    {
      this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
      //output.SelectedDateTime = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
    }
    else if (typecode == 305) // url
    {
      this.outputValue = valueArray.length === 0 ? null : JSON.parse(valueArray[0].data);
      //output.Url = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
      // } else if (output.hasOwnProperty('ReferencedGeometry')) {
      //   this.outputValue = valueArray;
      //output.ReferencedGeometry = swarmOutput.InnerTree['{ 0; }'];
    }
    else // everything else
    {
      this.outputValue = valueArray !== undefined ? valueArray : null ;
    }

    this.attribute = valueArray !== undefined && valueArray.length != 0  ? valueArray[0].attributes : null ;
  }
}



module.exports = SwarmApp;
