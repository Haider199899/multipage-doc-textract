import express from 'express';
import fileUploadRouter from './routes/textract';

const app = express();

app.use('/extract-text', fileUploadRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

