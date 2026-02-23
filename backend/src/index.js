import express from 'express';
import cors from 'cors';
import streamsRouter from './routes/streams.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Stream routes
app.use('/api/streams', streamsRouter);

app.listen(PORT, () => {
  console.log(`[StreamFlow API] Running on port ${PORT}`);
  console.log(`[StreamFlow API] MediaMTX API: ${process.env.MEDIAMTX_API || 'http://mediamtx:9997'}`);
});
