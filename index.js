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


class SwarmCompute {
  constructor(units, tolerance) {
    this.document = null;
    // this.definition = null;
    // this.pointer = def.awsPointer;
    this.platform = "API";
    this.project = null;
    this.supplemental = [];
    this.values = [];
    this.version = 6;
  }

  // Method
  setDocument(units, tolerance) {
    this.document = {
      tolerance: 0.01,
      units: 8
    };
  }

  setProject(proj) {
    this.project = proj;
  }

  setPlatform(p) {
    this.platform = p;
  }

  addInput(input) {
    const newInput = {
      Keys: ["{ 0; }"],
      InnerTree: {}
    };

    // newInput.InnerTree["{ 0; }"] = [];


    const typeNum = Object.keys(typeDict)[Object.values(typeDict).indexOf(input.type)];
    console.log("typeNum", typeNum);
    const paramName = "SWRM_IN:" + typeNum + input.name;
    newInput.ParamName = paramName;

    input.values.forEach(in => {
      var tree = [];
      var swarmObj = {};
      //console.log(input.Typecode);
      // toSwarmTree
      if (in.Typecode == 106 || in.Typecode == 301 || in.Typecode == 302) { // Text
        swarmObj.type = "System.String";
        swarmObj.data = `\"` + in.Text + `\"`;
        tree.push(swarmObj);
      } else if (in.Typecode == 105 || in.Typecode == 201) { // Number and Slider
        swarmObj.type = "System.Double";
        swarmObj.data = in.Value;
        tree.push(swarmObj);
      } else if (in.Typecode == 104) { // Integer
        swarmObj.type = "System.Int32";
        swarmObj.data = in.Value;
        tree.push(swarmObj);
      } else if (in.Typecode == 101 || in.Typecode == 202) { // Boolean or Boolean Toogle
        swarmObj.type = "System.Boolean";
        //console.log("in.State", in.State);
        swarmObj.data = `\"` + in.State + `\"`;
        tree.push(swarmObj);
      } else if (in.Typecode == 116) { // Time
        swarmObj.type = "System.DateTime";
        swarmObj.data = `\"` + in.SelectedDateTime + `\"`;
        tree.push(swarmObj);
      } else if (in.Typecode == 203) { // Value List
        swarmObj.type = "System.String";
        var selected = in.Values.find(v => v.Key == in.Key);
        swarmObj.data = JSON.stringify(selected.Value);
        tree.push(swarmObj);
      } else if (in.Typecode == 306) {
        console.log("TODO not sure how swarm object ", in);
        swarmObj.type = "System.Object";
        swarmObj.data = JSON.stringify(in.Lines);
        tree.push(swarmObj);
      } else if (in.hasOwnProperty('ReferencedGeometry')) {
        if (in.ReferencedGeometry != undefined && in.ReferencedGeometry.length > 0) {
          in.ReferencedGeometry.forEach(element => {
            tree.push(element);
          });
        }
      } else {
        console.log("TODO new type ? ", in.type);
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

    console.log("this.values", this.values);


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


module.exports = SwarmCompute;
