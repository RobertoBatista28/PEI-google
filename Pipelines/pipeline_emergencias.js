[
  {
    $set: {
      SubmissionTimestamp: "$$NOW",
      HospitalId: { $toInt: "$institutionId" },
      LastUpdate: { $toDate: "$LastUpdate" },
      ExtractionDate: { $toDate: "$extractionDate" },
      EmergencyStatus: { $ifNull: ["$EmergencyStatus", "Aberta"] },
      "EmergencyType.Code": { $trim: { input: { $toString: "$EmergencyType.Code" } } },
      "EmergencyType.Description": { $trim: { input: "$EmergencyType.Description" } },
      "Triage.Red.Time": { $toInt: "$Triage.Red.Time" },
      "Triage.Red.Length": { $toInt: "$Triage.Red.Length" },
      "Triage.Orange.Time": { $toInt: "$Triage.Orange.Time" },
      "Triage.Orange.Length": { $toInt: "$Triage.Orange.Length" },
      "Triage.Yellow.Time": { $toInt: "$Triage.Yellow.Time" },
      "Triage.Yellow.Length": { $toInt: "$Triage.Yellow.Length" },
      "Triage.Green.Time": { $toInt: "$Triage.Green.Time" },
      "Triage.Green.Length": { $toInt: "$Triage.Green.Length" },
      "Triage.Blue.Time": { $toInt: "$Triage.Blue.Time" },
      "Triage.Blue.Length": { $toInt: "$Triage.Blue.Length" },
      // Gerar dados aleatórios para Observation baseados nos valores de Triage
      "Observation.Red.Time": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Red.Time", 
            { $add: [{ $toInt: "$Triage.Red.Time" }, { $multiply: [{ $rand: {} }, 20] }] }
          ] 
        } 
      },
      "Observation.Red.Length": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Red.Length", 
            { $multiply: [{ $toInt: "$Triage.Red.Length" }, { $add: [1, { $multiply: [{ $rand: {} }, 2] }] }] }
          ] 
        } 
      },
      "Observation.Orange.Time": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Orange.Time", 
            { $add: [{ $toInt: "$Triage.Orange.Time" }, { $multiply: [{ $rand: {} }, 30] }] }
          ] 
        } 
      },
      "Observation.Orange.Length": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Orange.Length", 
            { $multiply: [{ $toInt: "$Triage.Orange.Length" }, { $add: [1, { $multiply: [{ $rand: {} }, 2] }] }] }
          ] 
        } 
      },
      "Observation.Yellow.Time": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Yellow.Time", 
            { $add: [{ $toInt: "$Triage.Yellow.Time" }, { $multiply: [{ $rand: {} }, 60] }] }
          ] 
        } 
      },
      "Observation.Yellow.Length": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Yellow.Length", 
            { $multiply: [{ $toInt: "$Triage.Yellow.Length" }, { $add: [1, { $multiply: [{ $rand: {} }, 2] }] }] }
          ] 
        } 
      },
      "Observation.Green.Time": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Green.Time", 
            { $add: [{ $toInt: "$Triage.Green.Time" }, { $multiply: [{ $rand: {} }, 90] }] }
          ] 
        } 
      },
      "Observation.Green.Length": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Green.Length", 
            { $multiply: [{ $toInt: "$Triage.Green.Length" }, { $add: [1, { $multiply: [{ $rand: {} }, 2] }] }] }
          ] 
        } 
      },
      "Observation.Blue.Time": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Blue.Time", 
            { $add: [{ $toInt: "$Triage.Blue.Time" }, { $multiply: [{ $rand: {} }, 120] }] }
          ] 
        } 
      },
      "Observation.Blue.Length": { 
        $toInt: { 
          $ifNull: [
            "$Observation.Blue.Length", 
            { $multiply: [{ $toInt: "$Triage.Blue.Length" }, { $add: [1, { $multiply: [{ $rand: {} }, 2] }] }] }
          ] 
        } 
      }
    }
  },
  {
    $lookup: {
      from: "staging_hospitais",
      localField: "HospitalId",
      foreignField: "HospitalID",
      as: "HospitalData"
    }
  },
  {
    $set: {
      HospitalName: { $arrayElemAt: ["$HospitalData.HospitalName", 0] },
      HospitalAddress: { $arrayElemAt: ["$HospitalData.Address", 0] }
    }
  },
  {
    $project: {
      HospitalData: 0,
      institutionId: 0,
      extractionDate: 0
    }
  },
  {
    $merge: {
      into: "Urgencia",
      whenMatched: "replace",
      whenNotMatched: "insert"
    }
  }
]