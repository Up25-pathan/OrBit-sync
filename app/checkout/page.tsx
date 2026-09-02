'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

const CardIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent-red)" : "#808085"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s' }}>
    <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="2" y1="10" x2="22" y2="10"></line>
  </svg>
);

const PayPalIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#0070ba" : "#808085"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s' }}>
    <path d="M7 2h7a5 5 0 0 1 0 10H9v10H5V7c0-2.8 2.2-5 5-5z"></path>
  </svg>
);

const UpiIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#3395FF" : "#808085"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s' }}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
    <line x1="12" y1="18" x2="12.01" y2="18"></line>
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3395FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const DatabaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
  </svg>
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://orbit-sync.onrender.com' : 'http://localhost:5000');

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan') || 'mesh'; // default to mesh (Mesh Cluster)

  const [isClient, setIsClient] = useState(false);
  const [token, setToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  
  // Payment Gateway Tab Selection: 'stripe' | 'paypal' | 'razorpay'
  const [gateway, setGateway] = useState<'stripe' | 'paypal' | 'razorpay'>('stripe');
  
  // Localized Geolocation State
  const [localeInfo, setLocaleInfo] = useState({
    countryCode: 'US',
    currency: 'USD',
    symbol: '$',
  });

  // Checkout Form States
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  
  // Loading & Processing States
  const [processing, setProcessing] = useState(false);

  // Authenticate session and load scripts on mount
  useEffect(() => {
    setIsClient(true);
    
    // Dynamically append Razorpay CDN script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    const userString = localStorage.getItem('orbit_user');
    if (!userString) {
      router.push(`/login?redirect=checkout&plan=${planParam}`);
    } else {
      try {
        const parsed = JSON.parse(userString);
        if (!parsed.token) {
          router.push(`/login?redirect=checkout&plan=${planParam}`);
        } else {
          setToken(parsed.token);
          setUserEmail(parsed.email || 'developer@orbit.dev');
        }
      } catch (e) {
        router.push(`/login?redirect=checkout&plan=${planParam}`);
      }
    }

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [router, planParam]);

  // Detect Country & Currency Localisation
  useEffect(() => {
    const detectLocale = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('IP lookup failed');
        const data = await res.json();
        const code = data.country_code || 'US';
        updateLocaleState(code);
      } catch (err) {
        // Fallback Timezone detect
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let code = 'US';
        if (timeZone.includes('Calcutta') || timeZone.includes('Asia/Kolkata') || timeZone.includes('Asia/Calcutta')) {
          code = 'IN';
        } else if (timeZone.includes('Asia/Shanghai') || timeZone.includes('Asia/Chongqing')) {
          code = 'CN';
        } else if (timeZone.includes('Asia/Tokyo')) {
          code = 'JP';
        } else if (timeZone.includes('Europe/London') || timeZone.includes('Europe/Belfast')) {
          code = 'GB';
        } else if (timeZone.includes('Europe/')) {
          code = 'EU';
        } else if (timeZone.includes('Australia/')) {
          code = 'AU';
        } else if (timeZone.includes('America/Toronto') || timeZone.includes('America/Vancouver')) {
          code = 'CA';
        }
        updateLocaleState(code);
      }
    };

    const updateLocaleState = (code: string) => {
      let cur = 'USD';
      let sym = '$';

      switch (code) {
        case 'IN':
          cur = 'INR'; sym = '₹'; setGateway('razorpay'); // Preset to Razorpay inside India!
          break;
        case 'CN':
          cur = 'CNY'; sym = '¥'; setGateway('stripe');
          break;
        case 'JP':
          cur = 'JPY'; sym = '¥'; setGateway('stripe');
          break;
        case 'GB':
          cur = 'GBP'; sym = '£'; setGateway('stripe');
          break;
        case 'CA':
          cur = 'CAD'; sym = 'C$'; setGateway('stripe');
          break;
        case 'AU':
          cur = 'AUD'; sym = 'A$'; setGateway('stripe');
          break;
        case 'DE':
        case 'FR':
        case 'IT':
        case 'ES':
        case 'NL':
        case 'BE':
        case 'AT':
        case 'IE':
        case 'FI':
        case 'GR':
        case 'PT':
        case 'EU':
          cur = 'EUR'; sym = '€'; setGateway('stripe');
          break;
        default:
          cur = 'USD'; sym = '$'; setGateway('stripe');
      }

      setLocaleInfo({ countryCode: code, currency: cur, symbol: sym });
      setGateway('razorpay');
    };

    detectLocale();
  }, []);

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'ORBIT20') {
      setCouponApplied(true);
      alert('Coupon code applied successfully: 20% discount activated!');
    } else {
      alert('Invalid coupon code.');
    }
  };

  // ----------------------------------------------------
  // PRICING CALCULATIONS & CONVERSIONS
  // ----------------------------------------------------
  const ratesMap: Record<string, { mesh: number; pro: number }> = {
    USD: { mesh: 29.00, pro: 9.00 },
    INR: { mesh: 2400.00, pro: 750.00 },
    CNY: { mesh: 210.00, pro: 65.00 },
    JPY: { mesh: 4500.00, pro: 1400.00 },
    EUR: { mesh: 27.00, pro: 8.00 },
    GBP: { mesh: 23.00, pro: 7.00 },
    CAD: { mesh: 39.00, pro: 12.00 },
    AUD: { mesh: 44.00, pro: 13.00 },
  };

  const currencyCode = localeInfo.currency;
  const rates = ratesMap[currencyCode] || ratesMap.USD;
  const planRate = planParam === 'mesh' ? rates.mesh : rates.pro;
  const discountAmount = couponApplied ? planRate * 0.2 : 0.0;
  const totalAmount = planRate - discountAmount;

  // Formatting strings helper
  const formattedRate = `${localeInfo.symbol}${planRate.toLocaleString()}`;
  const formattedDiscount = `${localeInfo.symbol}${discountAmount.toLocaleString()}`;
  const formattedTotal = `${localeInfo.symbol}${totalAmount.toLocaleString()}`;

  // ----------------------------------------------------
  // PAYMENT HANDLERS FOR EACH GATEWAY
  // ----------------------------------------------------

  // 1. Stripe Payment Handler (Cards, Apple / Google Pay)
  const handleStripePay = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/stripe/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: planParam }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate Stripe session.');
      }

      // If Stripe sandbox mode (keys not set), simulate checkout verification
      if (data.isSandbox) {
        console.log('[Stripe Sandbox] Simulating verified credit card transaction...');
        // Hit sandbox verify endpoint to update subscription in SQLite
        const verifyRes = await fetch(`${API_BASE_URL}/api/billing/stripe/verify-sandbox`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ planTier: planParam }),
        });

        if (verifyRes.ok) {
          router.push('/console?checkout_success=true&gateway=stripe');
        } else {
          alert('Stripe sandbox validation failed.');
          setProcessing(false);
        }
      } else {
        // Redirect to real Stripe checkout session URL
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Stripe billing error:', err);
      alert(err.message || 'Connection to Stripe gateway failed.');
      setProcessing(false);
    }
  };

  // 2. PayPal Payment Handler
  const handlePayPalPay = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/paypal/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: planParam }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create PayPal order.');
      }

      console.log('[PayPal SDK] Launching express payment dialog...', data.orderId);
      
      // Simulate PayPal overlay modal popup
      const paypalWindow = window.open('', 'PayPalCheckout', 'width=450,height=600,top=100,left=100');
      if (paypalWindow) {
        paypalWindow.document.write(`
          <html>
            <head>
              <title>PayPal Secure Authorization</title>
              <style>
                body { background: #0c0a0a; color: #fff; font-family: sans-serif; text-align: center; padding: 40px 20px; }
                .logo { font-size: 24px; font-weight: bold; color: #0070ba; margin-bottom: 20px; }
                .btn { background: #ffc439; color: #111; font-weight: bold; padding: 12px 30px; border: none; border-radius: 20px; cursor: pointer; margin-top: 30px; }
                .loader { border: 4px solid #333; border-top: 4px solid #ffc439; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; display: none; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <div class="logo">PayPal</div>
              <h3>Authorize Transaction</h3>
              <p>Sign in to your PayPal account to approve: <strong>${formattedTotal}</strong></p>
              <p style="color: #888; font-size: 13px;">Order ID: ${data.orderId}</p>
              <button class="btn" onclick="approve()">Authorize & Pay Now</button>
              <div class="loader" id="loader"></div>
              <script>
                function approve() {
                  document.getElementById('loader').style.display = 'block';
                  document.querySelector('.btn').style.display = 'none';
                  setTimeout(() => {
                    window.opener.postMessage({ type: 'paypal_success', orderId: '${data.orderId}' }, '*');
                    window.close();
                  }, 1200);
                }
              </script>
            </body>
          </html>
        `);
      }

      // Listen for PayPal simulation message callback
      const messageListener = async (event: MessageEvent) => {
        if (event.data?.type === 'paypal_success') {
          window.removeEventListener('message', messageListener);
          try {
            // Trigger payment capture verify call
            const captureRes = await fetch(`${API_BASE_URL}/api/billing/paypal/capture`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ orderId: event.data.orderId, planTier: planParam }),
            });

            if (captureRes.ok) {
              router.push('/console?checkout_success=true&gateway=paypal');
            } else {
              alert('PayPal verification capture failed.');
              setProcessing(false);
            }
          } catch (err) {
            alert('PayPal connection timed out.');
            setProcessing(false);
          }
        }
      };
      window.addEventListener('message', messageListener);

    } catch (err: any) {
      console.error('PayPal checkout error:', err);
      alert(err.message || 'PayPal payment launch failed.');
      setProcessing(false);
    }
  };

  // 3. Razorpay Payment Handler (UPI, Netbanking)
  const handleRazorpayPay = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/razorpay/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: planParam }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate Razorpay order.');
      }

      if (!(window as any).Razorpay) {
        alert('Razorpay Gateway script failed to load. Please verify connection.');
        setProcessing(false);
        return;
      }

      const isZeroDecimal = ['JPY'].includes(currencyCode);
      const amountSubunits = isZeroDecimal ? Math.round(totalAmount) : Math.round(totalAmount * 100);

      const options = {
        key: data.keyId,
        order_id: data.orderId,
        amount: amountSubunits,
        currency: currencyCode === 'INR' ? 'INR' : 'USD', // Razorpay standard INR or international routing
        name: "OrBit Platform",
        description: planParam === 'mesh' ? 'Mesh Cluster Tier' : 'Developer Pro Tier',
        prefill: {
          email: userEmail,
        },
        theme: {
          color: "#ff003c",
        },
        handler: async function (response: any) {
          setProcessing(true);
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/api/billing/razorpay/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                planTier: planParam,
              }),
            });

            if (verifyRes.ok) {
              router.push('/console?checkout_success=true&gateway=razorpay');
            } else {
              alert('Razorpay payment signature verify failed.');
              setProcessing(false);
            }
          } catch (err) {
            alert('Signature verification timed out.');
            setProcessing(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      setProcessing(false);

    } catch (err: any) {
      console.error('Razorpay payment error:', err);
      alert(err.message || 'Razorpay initialization failed.');
      setProcessing(false);
    }
  };

  const handlePaySecurely = (e: React.FormEvent) => {
    e.preventDefault();
    if (gateway === 'stripe') handleStripePay();
    if (gateway === 'paypal') handlePayPalPay();
    if (gateway === 'razorpay') handleRazorpayPay();
  };

  const planTitle = planParam === 'mesh' ? 'Mesh Cluster Tier' : 'Developer Pro Tier';
  const planDesc = planParam === 'mesh' 
    ? '15 cluster devices, Global WAN relay syncs, end-to-end AES encryptions.'
    : 'Unlimited LAN nodes, automatic CRDT conflict resolution.';

  if (!isClient || !token) {
    return (
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Authenticating Payment Session...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '120px 8% 60px 8%',
      }}
    >
      <Aurora />
      <CursorGlow />

      <div style={{ maxWidth: '1050px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            🔒 SSL Encrypted Checkout
          </span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', margin: '10px 0 15px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Secure Checkout
          </h1>
          <p style={{ color: '#a0a0a5', maxWidth: '550px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Complete your subscription purchase securely. Select your preferred payment gateway method below.
          </p>
        </div>

        {/* Split grid layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'start' }}>
          
          {/* Left Side: Multi-Gateway Panel */}
          <TiltCard
            style={{
              background: 'rgba(10, 8, 8, 0.75)',
              border: '1px solid rgba(255, 0, 60, 0.15)',
              borderRadius: '16px',
              padding: '35px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ transform: 'translateZ(10px)', marginBottom: '30px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-orbitron)', marginBottom: '20px', textAlign: 'center' }}>
                Select Secure Gateway
              </h3>
              
              {/* Payment selector tabs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', background: '#070505', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Stripe and PayPal are temporarily disabled until configured in production
                <button
                  onClick={() => setGateway('stripe')}
                  style={{
                    background: gateway === 'stripe' ? 'rgba(255,0,60,0.08)' : 'transparent',
                    border: `1.5px solid ${gateway === 'stripe' ? 'rgba(255,0,60,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    color: gateway === 'stripe' ? '#fff' : '#808085',
                    padding: '12px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CardIcon active={gateway === 'stripe'} />
                  <span>Cards / Wallets</span>
                </button>
                <button
                  onClick={() => setGateway('paypal')}
                  style={{
                    background: gateway === 'paypal' ? 'rgba(0,112,186,0.08)' : 'transparent',
                    border: `1.5px solid ${gateway === 'paypal' ? 'rgba(0,112,186,0.25)' : 'rgba(255,255,255,0.05)'}`,
                    color: gateway === 'paypal' ? '#fff' : '#808085',
                    padding: '12px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <PayPalIcon active={gateway === 'paypal'} />
                  <span>PayPal</span>
                </button>
                */}
                <button
                  onClick={() => setGateway('razorpay')}
                  style={{
                    background: gateway === 'razorpay' ? 'rgba(51,149,255,0.08)' : 'transparent',
                    border: `1.5px solid ${gateway === 'razorpay' ? 'rgba(51,149,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                    color: gateway === 'razorpay' ? '#fff' : '#808085',
                    padding: '12px 10px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <UpiIcon active={gateway === 'razorpay'} />
                  <span>UPI / Cards / Netbanking (Razorpay Secure Checkout)</span>
                </button>
              </div>
            </div>

            {/* GATEWAY OPTIONS RENDERING */}
            <div style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: 'translateZ(15px)' }}>
              
              {/* Option A: Stripe Checkout */}
              {gateway === 'stripe' && (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '1.8rem', color: '#6772e5', fontWeight: 900, fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>
                    stripe
                  </div>
                  <p style={{ color: '#a0a0a5', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '25px', maxWidth: '340px', margin: '0 auto 25px auto' }}>
                    Pay securely using international Credit/Debit Cards, Apple Pay, or Google Pay via Stripe.
                  </p>
                  <button
                    onClick={handlePaySecurely}
                    disabled={processing}
                    className="glow-btn"
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      background: 'var(--accent-red)',
                      border: 'none',
                      color: '#fff',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'var(--font-orbitron)',
                      letterSpacing: '1px',
                    }}
                  >
                    {processing ? 'Connecting Stripe...' : `Pay ${formattedTotal} with Stripe`}
                  </button>
                </div>
              )}

              {/* Option B: PayPal Express */}
              {gateway === 'paypal' && (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '1.8rem', color: '#0070ba', fontWeight: 900, fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>
                    PayPal
                  </div>
                  <p style={{ color: '#a0a0a5', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '25px', maxWidth: '340px', margin: '0 auto 25px auto' }}>
                    Log in to your PayPal account to process secure subscription authorization and capture.
                  </p>
                  <button
                    onClick={handlePaySecurely}
                    disabled={processing}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      background: '#ffc439',
                      border: 'none',
                      color: '#111',
                      padding: '14px',
                      borderRadius: '30px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      cursor: processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 10px rgba(255, 196, 57, 0.25)',
                    }}
                  >
                    {processing ? 'Launching PayPal...' : `Checkout with PayPal`}
                  </button>
                </div>
              )}

              {/* Option C: Razorpay Gateway */}
              {gateway === 'razorpay' && (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '1.8rem', color: '#3395FF', fontWeight: 900, fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>
                    razorpay
                  </div>
                  <p style={{ color: '#a0a0a5', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '25px', maxWidth: '340px', margin: '0 auto 25px auto' }}>
                    Pay securely with UPI (GPay/PhonePe), Indian Netbanking, Wallets, or Cards via Razorpay.
                  </p>
                  <button
                    onClick={handlePaySecurely}
                    disabled={processing}
                    className="glow-btn"
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      background: 'var(--accent-red)',
                      border: 'none',
                      color: '#fff',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'var(--font-orbitron)',
                      letterSpacing: '1px',
                    }}
                  >
                    {processing ? 'Connecting Razorpay...' : `Pay ${formattedTotal} with Razorpay`}
                  </button>
                </div>
              )}

            </div>

            {/* Compliance security footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '35px', paddingTop: '20px', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', transform: 'translateZ(10px)' }}>
              <span style={{ fontSize: '0.7rem', color: '#808085', display: 'flex', alignItems: 'center' }}>
                <ShieldIcon /> PCI-DSS COMPLIANT
              </span>
              <span style={{ fontSize: '0.7rem', color: '#808085', display: 'flex', alignItems: 'center' }}>
                <LockIcon /> SSL ENCRYPTED GATEWAYS
              </span>
              <span style={{ fontSize: '0.7rem', color: '#808085', display: 'flex', alignItems: 'center' }}>
                <DatabaseIcon /> SECURE DATA TRUST
              </span>
            </div>

          </TiltCard>

          {/* Right Side: Order Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div
              style={{
                background: 'rgba(10, 8, 8, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '30px',
                boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>
                Order Summary
              </h3>

              {/* Product description block */}
              <div style={{ paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>{planTitle}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                    {formattedRate}
                  </span>
                </div>
                <p style={{ color: '#808085', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                  {planDesc}
                </p>
              </div>

              {/* Coupon inputs */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <input
                  type="text"
                  placeholder="Coupon Code (try ORBIT20)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ flex: 1, background: '#060404', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 14px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                />
                <button
                  onClick={handleApplyCoupon}
                  type="button"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,0,60,0.1)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  Apply
                </button>
              </div>

              {/* Price Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#808085' }}>
                  <span>Monthly Charge:</span>
                  <span>
                    {formattedRate}
                  </span>
                </div>
                {couponApplied && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00e676' }}>
                    <span>Coupon Discount (20%):</span>
                    <span>
                      -{formattedDiscount}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#808085' }}>
                  <span>Taxes & VAT:</span>
                  <span>
                    {localeInfo.symbol}0
                  </span>
                </div>
              </div>

              {/* Total Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>
                <span>Total Due Today:</span>
                <span style={{ fontSize: '1.35rem', color: 'var(--accent-red)', textShadow: '0 0 8px rgba(255,0,60,0.3)', fontFamily: 'var(--font-orbitron)' }}>
                  {formattedTotal}
                </span>
              </div>

            </div>

            {/* Refund policy card */}
            <div
              style={{
                background: 'rgba(255, 0, 60, 0.015)',
                border: '1px dashed rgba(255, 0, 60, 0.25)',
                borderRadius: '12px',
                padding: '20px 25px',
                textAlign: 'center',
              }}
            >
              <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                30-Day Money Back Guarantee
              </h4>
              <p style={{ color: '#808085', fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
                If you are unsatisfied with OrBit synchronization limits, simply contact us within 30 days for a full refund.
              </p>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Loading Secure Checkout Gateway...</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
