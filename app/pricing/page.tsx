'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function PricingPage() {
  const router = useRouter();

  // Dynamic Country / Currency state variables
  const [localeInfo, setLocaleInfo] = useState({
    countryCode: 'US',
    currency: 'USD',
    symbol: '$',
    communityPrice: '$0',
    proPriceText: '$9',
    enterprisePriceText: 'Custom',
  });

  useEffect(() => {
    const detectLocale = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('IP lookup failed');
        const data = await res.json();
        const code = data.country_code || 'US';

        updateRates(code);
      } catch (err) {
        // Timezone fallback if API fails
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        let code = 'US';

        if (timeZone.includes('Calcutta') || timeZone.includes('Asia/Kolkata') || timeZone.includes('Asia/Calcutta')) {
          code = 'IN';
        } else if (timeZone.includes('Asia/Shanghai') || timeZone.includes('Asia/Chongqing') || timeZone.includes('Asia/Harbin')) {
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

        updateRates(code);
      }
    };

    const updateRates = (code: string) => {
      switch (code) {
        case 'IN':
          setLocaleInfo({
            countryCode: 'IN',
            currency: 'INR',
            symbol: '₹',
            communityPrice: '₹0',
            proPriceText: '₹750',
            enterprisePriceText: 'Custom',
          });
          break;
        case 'CN':
          setLocaleInfo({
            countryCode: 'CN',
            currency: 'CNY',
            symbol: '¥',
            communityPrice: '¥0',
            proPriceText: '¥65',
            enterprisePriceText: 'Custom',
          });
          break;
        case 'JP':
          setLocaleInfo({
            countryCode: 'JP',
            currency: 'JPY',
            symbol: '¥',
            communityPrice: '¥0',
            proPriceText: '¥1,400',
            enterprisePriceText: 'Custom',
          });
          break;
        case 'GB':
          setLocaleInfo({
            countryCode: 'GB',
            currency: 'GBP',
            symbol: '£',
            communityPrice: '£0',
            proPriceText: '£7',
            enterprisePriceText: 'Custom',
          });
          break;
        case 'CA':
          setLocaleInfo({
            countryCode: 'CA',
            currency: 'CAD',
            symbol: 'C$',
            communityPrice: 'C$0',
            proPriceText: 'C$12',
            enterprisePriceText: 'Custom',
          });
          break;
        case 'AU':
          setLocaleInfo({
            countryCode: 'AU',
            currency: 'AUD',
            symbol: 'A$',
            communityPrice: 'A$0',
            proPriceText: 'A$13',
            enterprisePriceText: 'Custom',
          });
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
          setLocaleInfo({
            countryCode: 'EU',
            currency: 'EUR',
            symbol: '€',
            communityPrice: '€0',
            proPriceText: '€8',
            enterprisePriceText: 'Custom',
          });
          break;
        default:
          // Default USD
          setLocaleInfo({
            countryCode: 'US',
            currency: 'USD',
            symbol: '$',
            communityPrice: '$0',
            proPriceText: '$9',
            enterprisePriceText: 'Custom',
          });
      }
    };

    detectLocale();
  }, []);

  const PLANS = [
    {
      name: 'Community',
      price: localeInfo.communityPrice,
      frequency: 'forever free',
      desc: 'Perfect for individual developers syncing local projects.',
      features: [
        '1 Node license allocation',
        'Max 2 peers per project sync',
        'Max 1 active workspace directory',
        'Up to 50MB sync file size limits',
        'Real-time sync logging HUD',
      ],
      buttonText: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Developer Pro',
      price: localeInfo.proPriceText,
      frequency: 'per month',
      desc: 'For power users needing cross-network WAN syncing.',
      features: [
        '1 Active developer seat',
        'Max 10 peers per project sync',
        'Max 10 active workspace directories',
        'Up to 1GB sync file size limits',
        '7-day logs history & dashboard metrics',
      ],
      buttonText: 'Upgrade to Pro',
      popular: true,
    },
    {
      name: 'Enterprise Grid',
      price: localeInfo.enterprisePriceText,
      frequency: 'tailored agreements',
      desc: 'For scaling teams requiring security compliance and SLAs.',
      features: [
        'Floating seat registry admin keys',
        'LAN Offline isolation mode (100% local)',
        'Unlimited peer connections & workspaces',
        'No file size limits (LFS binary optimized)',
        'Infinite log history + team exports',
      ],
      buttonText: 'Contact Enterprise',
      popular: false,
    },
  ];

  const handlePlanAction = (planName: string) => {
    if (planName === 'Enterprise Grid') {
      router.push('/contact?ref=enterprise');
      return;
    }

    const isLoggedIn = !!localStorage.getItem('orbit_user');

    if (planName === 'Developer Pro') {
      if (isLoggedIn) {
        router.push('/checkout?plan=pro');
      } else {
        router.push('/login?redirect=checkout&plan=pro');
      }
    } else {
      // Community Plan
      if (isLoggedIn) {
        router.push('/console');
      } else {
        router.push('/signup');
      }
    }
  };

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '120px 8% 100px 8%',
      }}
    >
      {/* Background nebulas & stars */}
      <Aurora />
      <CursorGlow />

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 5 }}>
        
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Flexible Options
          </span>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', margin: '15px 0 20px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Simple, Developer-First <span style={{ color: 'var(--accent-red)' }}>Pricing</span>
          </h1>
          <p style={{ color: '#a0a0a5', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Run OrBit free on your local dev environment, or scale to network sync grids with secure encrypted relays.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '30px',
            alignItems: 'stretch',
          }}
        >
          {PLANS.map((plan, idx) => (
            <TiltCard
              key={idx}
              style={{
                background: 'rgba(10, 8, 8, 0.7)',
                border: plan.popular ? '2px solid var(--accent-red)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '40px 30px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                boxShadow: plan.popular ? '0 10px 30px rgba(255,0,60,0.1)' : '0 10px 20px rgba(0,0,0,0.5)',
                height: '100%',
              }}
            >
              {plan.popular && (
                <span
                  style={{
                    position: 'absolute',
                    top: '15px',
                    right: '20px',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Popular
                </span>
              )}

              {/* Top details */}
              <div style={{ transform: 'translateZ(20px)' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-orbitron)' }}>{plan.name}</span>
                
                {/* Price display */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '20px 0 15px 0' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-orbitron)' }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#606065', fontFamily: 'monospace' }}>
                    / {plan.frequency}
                  </span>
                </div>

                <p style={{ color: '#808085', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '30px' }}>
                  {plan.desc}
                </p>

                {/* Features List */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    marginBottom: '40px',
                  }}
                >
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>✓</span>
                      <span style={{ color: '#a0a0a5', fontSize: '0.85rem' }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div style={{ transform: 'translateZ(10px)' }}>
                <button
                  onClick={() => handlePlanAction(plan.name)}
                  className={plan.popular ? 'glow-btn' : ''}
                  style={{
                    width: '100%',
                    background: plan.popular ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.05)',
                    border: plan.popular ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: plan.popular ? '0 4px 15px rgba(255, 0, 60, 0.35)' : 'none',
                    fontFamily: 'var(--font-orbitron)',
                    letterSpacing: '0.5px',
                  }}
                  onMouseEnter={(e) => {
                    if (!plan.popular) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!plan.popular) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  {plan.buttonText}
                </button>
              </div>
            </TiltCard>
          ))}
        </div>

      </div>
    </main>
  );
}
