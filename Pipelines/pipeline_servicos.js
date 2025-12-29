[
    {
        $set: {
            ServiceKey: { $toInt: { $toString: "$ServiceKey" } },
            Speciality: { $trim: { input: { $toString: "$Speciality" } } },
            TypeCode: { $toInt: { $toString: "$TypeCode" } },
            TypeDescription: { $trim: { input: { $toString: "$TypeDescription" } } },
            PriorityDescription: { $trim: { input: { $toString: "$PriorityDescription" } } }
        }
    },
    {
        $set: {
            PriorityDescription: {
                $switch: {
                    branches: [
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^1" } }, then: "Doença não oncológica (Normal)" },
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^2" } }, then: "Doença não oncológica (Prioritário)" },
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^3" } }, then: "Doença oncológica (Muito Prioritário)" }
                    ],
                    default: "$PriorityDescription"
                }
            },
            PriorityCode: {
                $switch: {
                    branches: [
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^1" } }, then: 1 },
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^2" } }, then: 2 },
                        { case: { $regexMatch: { input: "$PriorityDescription", regex: "^3" } }, then: 3 }
                    ],
                    default: { $toInt: "$PriorityCode" }
                }
            }
        }
    },
    {
        $merge: {
            into: "Servico",
            whenMatched: "replace",
            whenNotMatched: "insert"
        }
    }
]