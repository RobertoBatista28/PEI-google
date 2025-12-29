[
    {
        $project: {
            HospitalKey: { $toInt: "$HospitalKey" },
            HospitalId: { $toInt: "$HospitalID" },
            HospitalName: { $trim: { input: "$HospitalName" } },
            Description: { $trim: { input: "$Description" } },
            Address: { $trim: { input: "$Address" } },
            District: { $trim: { input: "$District" } },
            Latitude: { $toDouble: "$Latitude" },
            Longitude: { $toDouble: "$Longitude" },
            NUTSI: { $trim: { input: "$NUTSIDescription" } },
            NUTSII: { $trim: { input: "$NUTSIIDescription" } },
            NUTSIII: { $trim: { input: "$NUTSIIIDescription" } },
            PhoneNum: { $trim: { input: { $toString: "$PhoneNum" } } },
            Email: { $trim: { input: "$Email" } }
        }
    },
    {
        $merge: {
            into: "Hospital",
            whenMatched: "replace",
            whenNotMatched: "insert"
        }
    }
]
