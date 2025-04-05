import express, { Request, Response } from "express";
import multer from "multer";
import { processDocument } from "../services/textract";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/process",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return
      }
      const response = await processDocument(req.file);

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
