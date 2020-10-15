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
}


class SwarmApp {
  constructor(units, tolerance) {
    this.document = null;
    this.inputValues = [];
    this.appToken = null;
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

  callIntoSwarm() {

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const reqBody = {
          token: this.appToken,
          inputs: this.inputValues.map(v => v.toObject())
        }

        // var jsonString = JSON.stringify(this.inputValues);
        // reqBody.inputs = JSON.parse(jsonString);

        console.log("this.inputValues", this.inputValues);

        axios
          .post('https://dev-swarm.herokuapp.com/api/external/compute', reqBody)
          .then((res) => {
            // console.log(`statusCode: ${res.statusCode}`);
            console.log("res.data", res.data);
            let outputList = [];

            res.data.values.forEach(function(val) {
              let currentOutput = new Output(val);
              currentOutput.setOutputValue(val.InnerTree['{ 0; }'])
              outputList.push(currentOutput);
            });
            console.log("outputList", outputList);
            // resolve(res.data.values[0].InnerTree['{ 0; }']);
            resolve(outputList);
          })
          .catch((error) => {
            console.error(error);
            reject(`Error in callback ${error}`);
          })
        // resolve(this);
      }, 5000);
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

    input.values.forEach(function(inp) {
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
        if (input.ReferencedGeometry != undefined && input.ReferencedGeometry.length > 0) {
          input.ReferencedGeometry.forEach(element => {
            const currentGeo = {
            //   type: "Rhino.Geometry.Point",
            //   data: JSON.stringify(element),
            //   attributes: {
            //     "Name": null,
            //     "LayerName": null,
            //     "LayerIndex": -1,
            //     "UserDictionary": {},
            //     "DisplayColor": ""
            //   }
            // };
            // console.log("currentGeo", currentGeo);
            console.log("point element", element);

            tree.push(element);
          });
        }
      } else if (typecode == 108) { // Curves
        if (input.ReferencedGeometry != undefined && input.ReferencedGeometry.length > 0) {
          input.ReferencedGeometry.forEach(element => {
            const currentGeo = {
              type: "Rhino.Geometry.PolylineCurve",
              data: JSON.stringify(element),
              attributes: {
                "Name": null,
                "LayerName": null,
                "LayerIndex": -1,
                "UserDictionary": {},
                "DisplayColor": ""
              }
            };
            console.log("currentGeo", currentGeo);

            tree.push(currentGeo);
          });
        }
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

      tree.attributes = {
        "Name": null,
        "LayerName": null,
        "LayerIndex": -1,
        "UserDictionary": {},
        "DisplayColor": ""
      }

      console.log("tree", tree);

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
    this.attribute = output.InnerTree['{ 0; }'].attributes;
    this.outputValue = null
  }

  setOutputValue(valueArray) {
    // var valueArray = Object.values(swarmOutput.InnerTree)[0];
    console.log("output name", this.name);
    if (this.name.split(':').length < 2) return;
    let typecode = this.name.split(':')[1];

    console.log("typecode", typecode);
    if (typecode == 106) // text
    {
      //output.Text = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
      this.outputValue = JSON.parse(valueArray[0].data);
    } else if (typecode == 301 || typecode == 302) // multiline panel
    {
      var concat = valueArray.map(val => {
        return JSON.parse(val.data);
      });

      this.outputValue = concat.join(",");
    } else if (typecode == 104 || typecode == 105 || typecode == 201) // integer and Number || Slider
    {
      this.outputValue = JSON.parse(valueArray[0].data);
      //output.Value = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data)
    }
    else if (typecode == 101 || typecode == 202) // boolean || boolean Togle
    {
      this.outputValue = JSON.parse(valueArray[0].data);
      //output.State = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data == "true");
    }
    else if (typecode == 116) // time
    {
      this.outputValue = JSON.parse(valueArray[0].data);
      //output.SelectedDateTime = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
    }
    else if (typecode == 305) // url
    {
      this.outputValue = JSON.parse(valueArray[0].data);
      //output.Url = JSON.parse(swarmOutput.InnerTree['{ 0; }'][0].data);
    // } else if (output.hasOwnProperty('ReferencedGeometry')) {
    //   this.outputValue = valueArray;
      //output.ReferencedGeometry = swarmOutput.InnerTree['{ 0; }'];
    }

    this.attribute = valueArray[0].attributes;
  }
}



module.exports = SwarmApp;
