'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface UserData {
  email: string;
  displayName: string;
}

interface SubscriptionData {
  planTier: string;
  status: string;
  expiresAt: string;
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://orbit-sync.onrender.com';

  useEffect(() => {
    const fetchInvoiceData = async () => {
      const userString = localStorage.getItem('orbit_user');
      if (!userString) {
        router.push('/login');
        return;
      }

      try {
        const parsed = JSON.parse(userString);
        const token = parsed.token;

        const res = await fetch(`${API_BASE_URL}/api/console/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setSubscription(data.subscription);
          setLoading(false);
        } else {
          router.push('/console');
        }
      } catch (error) {
        console.error('Failed to load invoice details:', error);
        router.push('/console');
      }
    };

    fetchInvoiceData();
  }, [router, API_BASE_URL]);

  if (loading || !user || !subscription) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0808', color: '#808085', fontFamily: 'monospace' }}>
        Loading printable receipt statement...
      </div>
    );
  }

  const isPro = subscription.planTier.toLowerCase() === 'pro';
  const planName = isPro ? 'Pro Developer Plan' : 'Mesh Distributed Plan';
  const chargeAmount = isPro ? '₹750.00' : '₹2,400.00';
  const paymentMethod = 'Razorpay Checkout (UPI/Card)';

  return (
    <div style={{ background: '#fff', color: '#000', minHeight: '100vh', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @media print {
          body {
            background: #fff;
            color: #000;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Main Invoice Box */}
      <div className="print-container" style={{ maxWidth: '800px', margin: '0 auto', border: '1px solid #e0e0e0', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        
        {/* Actions header (Hidden during print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #f0f0f0', paddingBottom: '15px' }}>
          <button 
            onClick={() => router.push('/console')} 
            style={{ border: '1px solid #d0d0d0', background: 'transparent', color: '#303030', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Back to Console
          </button>
          <button 
            onClick={() => window.print()} 
            style={{ background: '#ff003c', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            Print / Save PDF
          </button>
        </div>

        {/* Header Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#ff003c' }}>OrBit</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#606060', lineHeight: '1.4' }}>
              OrBit Sync Solutions Inc.<br />
              100 Innovation Way, Suite 400<br />
              Developer Hub, CA 94043
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#303030' }}>Receipt</h2>
            <table style={{ marginTop: '10px', fontSize: '0.85rem', borderCollapse: 'collapse', float: 'right' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#606060', paddingRight: '15px', textAlign: 'right' }}>Invoice No:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{invoiceId}</td>
                </tr>
                <tr>
                  <td style={{ color: '#606060', paddingRight: '15px', textAlign: 'right' }}>Date:</td>
                  <td>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style={{ color: '#606060', paddingRight: '15px', textAlign: 'right' }}>Status:</td>
                  <td style={{ color: '#00c853', fontWeight: 'bold' }}>PAID</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ clear: 'both', height: '30px' }} />

        {/* Billing Info */}
        <div style={{ borderTop: '2px solid #303030', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#606060', letterSpacing: '0.5px' }}>Billed To:</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: '#111' }}>{user.displayName || 'OrBit Customer'}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.9rem', color: '#303030' }}>{user.email}</p>
          </div>
          <div style={{ minWidth: '200px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: '#606060', letterSpacing: '0.5px' }}>Payment Method:</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#303030' }}>{paymentMethod}</p>
          </div>
        </div>

        <div style={{ height: '40px' }} />

        {/* Invoice Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #111', color: '#111', fontWeight: 'bold' }}>
              <th style={{ padding: '12px 8px' }}>Description</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', width: '80px' }}>Qty</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', width: '120px' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e0e0e0', color: '#303030' }}>
              <td style={{ padding: '15px 8px' }}>
                <span style={{ fontWeight: 'bold', color: '#111' }}>{planName}</span>
                <div style={{ fontSize: '0.8rem', color: '#606060', marginTop: '4px' }}>Monthly cloud-clustering node pairing service & enterprise sync features.</div>
              </td>
              <td style={{ padding: '15px 8px', textAlign: 'right' }}>1</td>
              <td style={{ padding: '15px 8px', textAlign: 'right', fontWeight: 'bold' }}>{chargeAmount}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals Section */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <table style={{ width: '280px', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#606060' }}>Subtotal:</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>{chargeAmount}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#606060' }}>Tax / VAT (0%):</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>₹0.00</td>
              </tr>
              <tr style={{ borderTop: '1px solid #111', fontSize: '1.05rem', fontWeight: 'bold', color: '#111' }}>
                <td style={{ padding: '12px 0 0 0' }}>Total:</td>
                <td style={{ padding: '12px 0 0 0', textAlign: 'right', color: '#ff003c' }}>{chargeAmount}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ height: '60px' }} />

        {/* Footer info */}
        <div style={{ textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '20px', fontSize: '0.8rem', color: '#808080' }}>
          <p style={{ margin: 0 }}>Thank you for using OrBit Core Services!</p>
          <p style={{ margin: '4px 0 0 0' }}>For billing issues or questions, contact support@orbit.dev</p>
        </div>

      </div>
    </div>
  );
}
