import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import consoleRouter from './routes/console';
import licenseRouter from './routes/license';
import billingRouter from './routes/billing';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for client connections
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Route Stripe Webhook directly to parse raw request buffers (Stripe SDK signature checks require this)
// For all other routes, parse JSON bodies
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/console', consoleRouter);
app.use('/api/license', licenseRouter);
app.use('/api/billing', billingRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Global Error]:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(` OrBit API Server running on port ${PORT}`);
  console.log(` Client Origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(` SQLite Database: Active`);
  console.log(`=============================================`);
});
