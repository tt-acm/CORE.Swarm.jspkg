const typeDict = {
    101:"Boolean",
    102:"Point",
    103:"Vector",
    104:"Integer",
    105:"Number",
    106:"Text",
    107:"Line",
    108:"Curve",
    109:"Circle",
    110:"Plane",
    111:"Rectangle",
    112:"Box",
    113:"Surface",
    114:"Brep",
    115:"Mesh",
    116:"Time",
    201:"Slider",
    202: "Boolean Toggle",
    203: "Value List",
    301:"Panel",
    302:"MultilinePanel"
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
    const allValues = Object.values(typeDict);
    console.log("allValues", allValues);
    console.log("input.type", input.type);


    const typeNum = Object.keys(typeDict)[Object.values(typeDict).indexOf(input.type)];
    console.log("typeNum", typeNum);
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
