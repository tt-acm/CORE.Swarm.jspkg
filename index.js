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
    this.values = [];
    this.appToken = null;
  }

  // Method
  setDocument(units, tolerance) {
    this.document = {
      tolerance: tolerance,
      units: units
    };
  }

  setToken(token) {
    this.appToken = token;
  }
  //
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
          inputs: this.values
        }

        axios
          .post('https://dev-swarm.herokuapp.com/api/external/compute', reqBody)
          .then((res) => {
            // console.log(`statusCode: ${res.statusCode}`);
            console.log("res.data.values", res.data.values);
            resolve(res.data.values[0].InnerTree['{ 0; }']);
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
    const newInput = {
      Keys: ["{ 0; }"],
      InnerTree: {}
    };


    const typecode = findTypeCodeWithName(input.type);
    const paramName = "SWRM_IN:" + typecode + ":" + input.name;
    newInput.ParamName = paramName;

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

      newInput.InnerTree["{ 0; }"] = tree;

      newInput.Keys = ["{ 0; }"];
      newInput.Values = tree;
    });

    this.values.push(newInput);


    // this.platform = {
    //         "ParamName": "SWRM_IN:105:A",
    //         "InnerTree": {
    //             "{ 0; }": [
    //                 {
    //                     "type":"System.Double",
    //                     "data":5
    //                 }
    //             ]
    //         },
    //         "Keys":["{ 0; }"],
    //         "Values":[
    //             {
    //                 "type":"System.Double",
    //                 "data":5
    //             }
    //         ],
    //         "Count": 1,
    //         "IsReadOnly": false
    //     }
  }
}

// class Document {
//   constructor(units, tolerance) {
//     this.units = units;
//     this.tolerance = tolerance;
//   }
// }


module.exports = SwarmApp;
