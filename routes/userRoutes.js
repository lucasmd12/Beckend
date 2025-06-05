console.log("--- Loading userRoutes.js ---"); // Debug log
const express = require("express");
const multer = require("multer");
const User = require("../models/User"); // Ensure this path is correct
const { protect } = require("../middleware/authMiddleware"); // Assuming protect middleware is needed for some routes
const router = express.Router();

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the uploads directory exists
    const fs = require("fs");
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename to avoid conflicts
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, 	"_	")}`); // Replace spaces
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Example: Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de imagem são permitidos!"), false);
    }
  },
});

// --- User Routes ---

// @route   POST /api/users/:id/foto
// @desc    Upload user profile picture
// @access  Private (Requires user to be logged in and match :id or have admin rights)
// Applying protect middleware to ensure user is logged in
router.post("/users/:id/foto", protect, upload.single("foto"), async (req, res, next) => {
  console.log("--- Route Hit: POST /api/users/:id/foto ---"); // Debug log
  try {
    const userId = req.params.id;

    // Authorization check: Ensure the logged-in user is updating their own profile
    // Or implement admin role check if needed
    if (req.user.id !== userId) {
        return res.status(403).json({ error: "Não autorizado a atualizar esta foto de perfil." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo de imagem enviado." });
    }

    const imagePath = `uploads/${req.file.filename}`; // Relative path to store in DB

    const user = await User.findByIdAndUpdate(
      userId,
      { fotoPerfil: imagePath }, // Update the fotoPerfil field
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).select("-password"); // Exclude password from the returned user object

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    console.log(`User ${user.username} updated profile picture to ${imagePath}`);
    res.json({ message: "Foto de perfil atualizada com sucesso!", fotoPerfil: imagePath });

  } catch (err) {
     // Handle specific multer errors (like file size limit)
     if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
     }
     // Handle file filter errors
     if (err.message === "Apenas arquivos de imagem são permitidos!") {
         return res.status(400).json({ error: err.message });
     }
     // Handle other errors
     console.error("Erro ao atualizar foto de perfil:", err);
     res.status(500).json({ error: "Erro interno do servidor ao atualizar foto." });
  }
});


// @route   GET /api/cla/:id/membros
// @desc    Get members of a clan with online status
// @access  Private (Requires user to be logged in)
router.get("/cla/:id/membros", protect, async (req, res) => {
  console.log("--- Route Hit: GET /api/cla/:id/membros ---"); // Debug log
  try {
    const idCla = req.params.id;

    // TODO: Add authorization check if needed (e.g., only members of the clan can see the list)
    // const requestingUser = await User.findById(req.user.id);
    // if (!requestingUser || requestingUser.clan?.toString() !== idCla) {
    //   return res.status(403).json({ error: "Não autorizado a ver membros deste clã." });
    // }

    // Find users belonging to the specified clan ID
    // Ensure the field name 	"clan"	 matches your User schema
    const membros = await User.find({ clan: idCla }).select("username fotoPerfil ultimaAtividade");

    const agora = new Date();
    const membrosFormatados = membros.map((membro) => {
      const ultimaAtividade = membro.ultimaAtividade || new Date(0); // Handle null/undefined ultimaAtividade
      // Consider online if active within the last 5 minutes
      const minutosInativo = (agora.getTime() - ultimaAtividade.getTime()) / 60000;
      const online = minutosInativo <= 5;

      return {
        username: membro.username,
        fotoPerfil: membro.fotoPerfil || null, // Return null if no photo
        online: online,
      };
    });

    console.log(`Fetched ${membrosFormatados.length} members for clan ${idCla}`);
    res.json(membrosFormatados);

  } catch (err) {
    console.error("Erro ao buscar membros do clã:", err);
    res.status(500).json({ error: "Erro interno do servidor ao buscar membros do clã." });
  }
});

module.exports = router;

