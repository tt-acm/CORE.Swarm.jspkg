class SwarmCompute {
  constructor(units, tolerance) {
    this.document = null;
    this.definition = null;
  }

  // Method
  setDocument(units, tolerance) {
    this.document = new Document(units, tolerance);
  }
}

class Document {
  constructor(units, tolerance) {
    this.units = units;
    this.tolerance = tolerance;
  }
}


module.exports = SwarmCompute;
