const express = require("express");
const router = express.Router();
const Federation = require("../models/Federation");
const Clan = require("../models/Clan");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Hierarchy
 *   description: Rotas para obter a estrutura hierárquica de federações e clãs
 */

/**
 * @swagger
 * /api/hierarchy/full:
 *   get:
 *     summary: Obter a estrutura hierárquica completa de federações e clãs
 *     tags: [Hierarchy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estrutura hierárquica completa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       tag:
 *                         type: string
 *                       leader:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           username:
 *                             type: string
 *                       members:
 *                         type: array
 *                         items:
 *                           type: string
 *                       clans:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             flag:
 *                               type: string
 *                             leader:
 *                               type: object
 *                               properties:
 *                                 _id:
 *                                   type: string
 *                                 username:
 *                                   type: string
 *                             members:
 *                               type: array
 *                               items:
 *                                 type: string
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
router.get("/full", protect, async (req, res) => {
  try {
    const federations = await Federation.find()
      .populate("leader", "username")
      .populate({
        path: "clans",
        populate: {
          path: "leader",
          select: "username",
        },
      });

    res.json({ success: true, data: federations });
  } catch (error) {
    console.error("Erro ao obter hierarquia completa:", error);
    res.status(500).json({ msg: "Erro interno do servidor." });
  }
});

module.exports = router;


