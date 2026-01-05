const Hospital = require('../models/Hospital');

/**
 * Controller para gestão de hospitais
 */

// @desc    Listar todos os hospitais
// @route   GET /api/v1/hospitais
// @query   distrito, regiao, page, limit
exports.getHospitais = async (req, res, next) => {
  try {
    const { distrito, regiao, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (distrito) filters.District = { $regex: distrito, $options: 'i' };
    if (regiao) filters.NUTSII = { $regex: regiao, $options: 'i' };

    const hospitais = await Hospital.find(filters)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ HospitalName: 1 });

    const total = await Hospital.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: hospitais.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: hospitais
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter detalhes de um hospital
// @route   GET /api/v1/hospitais/:id
exports.getHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findOne({
      HospitalId: parseInt(req.params.id)
    });

    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: 'Hospital não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: hospital
    });
  } catch (error) {
    next(error);
  }
};


//@desc    Pesquisar hospitais próximos usando agregação (fórmula de Haversine)
//@route   GET /api/v1/hospitais/proximos
//@query   hospitalId (opcional) | lat, lng (opcionais) | distancia (km, opcional, default: 100)
exports.getHospitaisProximos = async (req, res, next) => {
  try {
    const { hospitalId, lat, lng, distancia } = req.query;
    let refLat, refLng;
    const raioMaximo = distancia ? parseFloat(distancia) : 100;

    if (hospitalId) {
      const hospitalOrigem = await Hospital.findOne({ HospitalId: parseInt(hospitalId) });

      if (!hospitalOrigem) {
        return res.status(404).json({ success: false, error: 'Hospital de origem não encontrado.' });
      }
      if (hospitalOrigem.Latitude == null || hospitalOrigem.Longitude == null) {
        return res.status(400).json({ success: false, error: 'O hospital selecionado não possui coordenadas geográficas válidas.' });
      }

      refLat = hospitalOrigem.Latitude;
      refLng = hospitalOrigem.Longitude;
    } else if (lat && lng) {
      refLat = parseFloat(lat);
      refLng = parseFloat(lng);
    } else {
      return res.status(400).json({ success: false, error: 'Forneça um "hospitalId" ou coordenadas "lat" e "lng".' });
    }

    // Raio da Terra em quilómetros
    const R = 6371;

    const pipeline = [
      {
        $match: {
          Latitude: { $ne: null },
          Longitude: { $ne: null },
          ...(hospitalId ? { HospitalId: { $ne: parseInt(hospitalId) } } : {})
        }
      },
      {
        $addFields: {
          latRad: { $degreesToRadians: "$Latitude" },
          lngRad: { $degreesToRadians: "$Longitude" },
          refLatRad: { $degreesToRadians: refLat },
          refLngRad: { $degreesToRadians: refLng }
        }
      },
      {
        $addFields: {
          dLat: { $subtract: ["$latRad", "$refLatRad"] },
          dLng: { $subtract: ["$lngRad", "$refLngRad"] }
        }
      },
      {
        $addFields: {
          a: {
            $add: [
              { $pow: [{ $sin: { $divide: ["$dLat", 2] } }, 2] },
              {
                $multiply: [
                  { $cos: "$refLatRad" },
                  { $cos: "$latRad" },
                  { $pow: [{ $sin: { $divide: ["$dLng", 2] } }, 2] }
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          distanciaKm: {
            $multiply: [
              R,
              {
                $multiply: [
                  2,
                  {
                    $atan2: [
                      { $sqrt: "$a" },
                      { $sqrt: { $subtract: [1, "$a"] } }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $match: {
          distanciaKm: { $lte: raioMaximo }
        }
      },
      {
        $sort: { distanciaKm: 1 }
      },
      {
        $project: {
          _id: 0,
          HospitalId: 1,
          HospitalName: 1,
          Address: 1,
          District: 1,
          NUTSII: 1,
          Latitude: 1,
          Longitude: 1,
          distanciaKm: { $round: ["$distanciaKm", 2] }
        }
      }
    ];

    const hospitaisProximos = await Hospital.aggregate(pipeline);

    res.status(200).json({
      success: true,
      origem: {
        tipo: hospitalId ? 'Hospital' : 'Coordenadas',
        referencia: hospitalId ? `ID: ${hospitalId}` : `${refLat}, ${refLng}`,
      },
      raioKm: raioMaximo,
      count: hospitaisProximos.length,
      data: hospitaisProximos
    });

  } catch (error) {
    next(error);
  }
};

module.exports = exports;
