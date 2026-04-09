import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Layout/Header';
import { Navigation } from './components/Layout/Navigation';
import { MineTab } from './components/Tabs/MineTab';
import { FightsTab } from './components/Tabs/FightsTab';
import { TopTab } from './components/Tabs/TopTab';
import { HubTab } from './components/Tabs/HubTab';
import { EarnTab } from './components/Tabs/EarnTab';
import { ProfileModal } from './components/UI/ProfileModal';
import { SettingsModal } from './components/UI/SettingsModal';
import { NotificationsModal } from './components/UI/NotificationsModal';
import { PaymentModal } from './components/UI/PaymentModal';
import { NetworkModal } from './components/UI/NetworkModal';
import { BlockDetailModal } from './components/UI/BlockDetailModal';
import { PrivacyModal } from './components/UI/PrivacyModal';
import { VerificationModal } from './components/UI/VerificationModal';
import { ParticleBackground } from './components/UI/ParticleBackground';
import { ShopModal } from './components/UI/ShopModal';
import { TelegramOnly } from './components/UI/TelegramOnly';
import { useAuth } from './hooks/useAuth';
import { useGameActions } from './hooks/useGameActions';
import { Tab, NetworkTier, UpgradeItem, MinedBlock, NotificationItem, Task } from './types';
import { miningHarvest } from './api';

const App: React.FC = () => {
  const { isLoading: authLoading, isAuthenticated, initData, error: authError, refreshState, retry: retryAuth } = useAuth();
  const actions = useGameActions();

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINE);
  const [isVerified, setIsVerified] = useState(() => localStorage.getItem('mining_verified') === 'true');
  const [showPrivacy, setShowPrivacy] = useState(() => localStorage.getItem('privacy_accepted') !== 'true');

  // ─── SINGLE SOURCE OF TRUTH: game state ───
  const [balance, setBalance] = useState(0);
  const [networth, setNetworth] = useState(0);
  const [energy, setEnergy] = useState(6000);
  const [maxEnergy, setMaxEnergy] = useState(6000);
  const [isMining, setIsMining] = useState(false);
  const [myRank, setMyRank] = useState<number>(0);
  const [myWeekRank, setMyWeekRank] = useState<number>(0);
  const [myMonthRank, setMyMonthRank] = useState<number>(0);
  const [myAllTimeRank, setMyAllTimeRank] = useState<number>(0);
  const [myPeakWeekRank, setMyPeakWeekRank] = useState<number>(0);
  const [myPeakMonthRank, setMyPeakMonthRank] = useState<number>(0);
  const [myPeakAllTimeRank, setMyPeakAllTimeRank] = useState<number>(0);
  const [weekEarned, setWeekEarned] = useState<number>(0);
  const [monthEarned, setMonthEarned] = useState<number>(0);
  const [generation, setGeneration] = useState(1);
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<NetworkTier>('Neural Link');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [username, setUsername] = useState('Operator');
  const [quests, setQuests] = useState<Task[]>([]);
  const [fightsLeft, setFightsLeft] = useState(5);
  const [extraFights, setExtraFights] = useState(0);
  const [botUsername, setBotUsername] = useState('purexprotocol_bot');
  const [telegramId, setTelegramId] = useState<number>(0);
  const [aggressorLevel, setAggressorLevel] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  // ─── Paid boost state ───
  const [autoMining, setAutoMining] = useState(false);
  const [autoMiningRemaining, setAutoMiningRemaining] = useState(0);
  const [turboActive, setTurboActive] = useState(false);
  const [turboRemaining, setTurboRemaining] = useState(0);

  // ─── Dynamic online counter (persists across tab switches) ───
  useEffect(() => {
    if (totalPlayers <= 0) return;
    const base = Math.max(1, Math.floor(totalPlayers / 3.5));
    const jitter = () => {
      const range = base < 100 ? Math.max(1, Math.floor(base * 0.15)) 
                   : base < 1000 ? Math.max(5, Math.floor(base * 0.06))
                   : Math.max(10, Math.floor(base * 0.02));
      return base + Math.floor(Math.random() * range * 2) - range;
    };
    setOnlineCount(jitter());
    const id = setInterval(() => setOnlineCount(jitter()), 20000);
    return () => clearInterval(id);
  }, [totalPlayers]);

  // ─── Modal state ───
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean, data: any, isPublic: boolean }>({ isOpen: false, data: null, isPublic: false });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; type: 'multitap' | 'energy' | 'autobot' | null }>({ isOpen: false, type: null });
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<MinedBlock | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  // ─── Sync server state when initData arrives ───
  useEffect(() => {
    if (!initData) return;
    const u = initData.user;
    setBalance(parseFloat(u.balance));
    setNetworth(parseFloat(u.networth || u.balance));
    setEnergy(u.energy);
    setMaxEnergy(u.max_energy);
    setIsMining(u.is_mining);
    setGeneration(u.generation);
    setIsVerified(u.is_verified);
    setFightsLeft(u.fights_left);
    setAggressorLevel(u.aggressor_level);
    setCurrentNetwork(u.network_tier as NetworkTier);
    setUsername(u.username || 'Operator');
    setTelegramId(u.telegram_id || 0);
    if (u.is_verified) localStorage.setItem('mining_verified', 'true');
    if (initData.botUsername) setBotUsername(initData.botUsername);
    if (initData.totalPlayers) setTotalPlayers(initData.totalPlayers);

    // Sync boost state
    const now = Date.now();
    if (u.auto_mining_until) {
      const remaining = Math.max(0, Math.floor((new Date(u.auto_mining_until).getTime() - now) / 1000));
      setAutoMining(remaining > 0);
      setAutoMiningRemaining(remaining);
    }
    if (u.turbo_boost_until) {
      const remaining = Math.max(0, Math.floor((new Date(u.turbo_boost_until).getTime() - now) / 1000));
      setTurboActive(remaining > 0);
      setTurboRemaining(remaining);
    }

    if (initData.quests && initData.quests.length > 0) {
      setQuests(initData.quests.map(q => ({
        id: String(q.id),
        type: q.type as Task['type'],
        title: q.title,
        description: q.description,
        reward: q.reward,
        icon: q.icon || 'star',
        isCompleted: q.is_completed,
        currentProgress: q.current_progress,
        targetProgress: q.target_progress,
        actionUrl: q.action_url,
        buttonLabel: q.button_label,
      })));
    }

    if (initData.upgrades && initData.upgrades.length > 0) {
      setUpgrades(initData.upgrades.map(su => ({
        id: su.id,
        name: su.name,
        description: su.description,
        category: su.category as UpgradeItem['category'],
        baseCost: parseFloat(su.base_cost),
        costMultiplier: su.cost_multiplier,
        currentLevel: su.current_level,
        maxLevel: su.max_level,
        benefitPerLevel: su.benefit_per_level,
      })));
    }

    // Fetch rank + referrals once on init
    actions.getLeaderboard().then(res => {
      if (res?.myRank != null) setMyRank(res.myRank);
      if (res?.myWeekRank) setMyWeekRank(res.myWeekRank);
      if (res?.myMonthRank) setMyMonthRank(res.myMonthRank);
      if (res?.myAllTimeRank) setMyAllTimeRank(res.myAllTimeRank);
      if (res?.myPeakWeekRank) setMyPeakWeekRank(res.myPeakWeekRank);
      if (res?.myPeakMonthRank) setMyPeakMonthRank(res.myPeakMonthRank);
      if (res?.myPeakAllTimeRank) setMyPeakAllTimeRank(res.myPeakAllTimeRank);
      if (res?.myWeekScore != null) setWeekEarned(res.myWeekScore);
      if (res?.myMonthScore != null) setMonthEarned(res.myMonthScore);
    });
    actions.getReferrals().then(res => {
      if (res) setReferralCount(res.count);
    });
  }, [initData]);

  // ─── Mining cooldown state ───
  const [miningCooldown, setMiningCooldown] = useState(0);
  const cooldownRef = useRef<number>();

  // Tick cooldown timer every second
  useEffect(() => {
    if (miningCooldown <= 0) { clearInterval(cooldownRef.current); return; }
    cooldownRef.current = window.setInterval(() => {
      setMiningCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [miningCooldown > 0]);

  // ─── Server sync: harvest polling ───
  const isMiningRef = useRef(isMining);
  useEffect(() => { isMiningRef.current = isMining; }, [isMining]);

  // Direct harvest call — bypasses hooks entirely to avoid any ref/closure issues
  const doHarvest = useCallback(async () => {
    try {
      const res = await miningHarvest();
      const bal = parseFloat(res.balance);
      const eng = res.energy;
      const maxE = res.max_energy ?? 6000;
      if (!isNaN(bal)) setBalance(bal);
      setEnergy(eng);
      setMaxEnergy(maxE);
      // Sync is_mining from server
      if (res.is_mining !== isMiningRef.current) {
        setIsMining(res.is_mining);
      }
      // Sync boost state
      if (res.auto_mining !== undefined) setAutoMining(res.auto_mining);
      if (res.auto_mining_remaining !== undefined) setAutoMiningRemaining(res.auto_mining_remaining);
      if (res.turbo_active !== undefined) setTurboActive(res.turbo_active);
      if (res.turbo_remaining !== undefined) setTurboRemaining(res.turbo_remaining);
    } catch (err) {
      console.error('[HARVEST] failed:', err);
    }
  }, []);

  // Single polling loop — interval adapts via ref, no effect restart on isMining change
  useEffect(() => {
    if (!isAuthenticated) return;
    // Immediate sync on mount
    doHarvest();

    // Adaptive polling: check ref each tick to decide next interval
    let timer: number;
    const scheduleTick = () => {
      const interval = isMiningRef.current ? 3000 : 10000;
      timer = window.setTimeout(async () => {
        await doHarvest();
        scheduleTick();
      }, interval);
    };
    scheduleTick();

    return () => { clearTimeout(timer); };
  }, [isAuthenticated, doHarvest]);

  // ─── Sync on tab change ───
  useEffect(() => {
    if (!isAuthenticated) return;
    doHarvest();
    actions.getLeaderboard().then(res => {
      if (res?.myRank != null) setMyRank(res.myRank);
    });
  }, [activeTab]);

  // ─── Boost countdown timer ───
  useEffect(() => {
    if (autoMiningRemaining <= 0 && turboRemaining <= 0) return;
    const id = setInterval(() => {
      setAutoMiningRemaining(prev => {
        if (prev <= 1) { setAutoMining(false); return 0; }
        return prev - 1;
      });
      setTurboRemaining(prev => {
        if (prev <= 1) { setTurboActive(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoMiningRemaining > 0 || turboRemaining > 0]);

  // ─── Derived values ───
  const hasUnreadNotifications = useMemo(() => notifications.some(n => !n.read), [notifications]);
  const totalLevels = useMemo(() => upgrades.reduce((acc, curr) => acc + curr.currentLevel, 0), [upgrades]);

  // ─── Aggressor level decay (cosmetic) ───
  useEffect(() => {
    const decay = setInterval(() => {
      setAggressorLevel(prev => Math.max(0, prev - 0.3));
    }, 12000);
    return () => clearInterval(decay);
  }, []);

  // ─── Handlers ───
  const handleToggleMining = useCallback(async () => {
    if (!isVerified) { setShowVerification(true); return; }
    if (autoMining) return; // Auto-mining active — can't toggle
    if (miningCooldown > 0) return; // Block while cooldown active
    if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');

    try {
      if (isMining) {
        // Stop succeeds unless auto-mining is active
        const res = await actions.stopMining();
        if (res) {
          setIsMining(res.is_mining);
          setBalance(res.balance);
          setEnergy(res.energy);
          if (res.autoMining !== undefined) setAutoMining(res.autoMining);
          if (res.autoMiningRemaining !== undefined) setAutoMiningRemaining(res.autoMiningRemaining);
        }
      } else {
        // Start may be rejected by cooldown
        const res = await actions.startMining();
        if (res.success) {
          setIsMining(true);
          if (res.energy != null) setEnergy(res.energy);
          // Immediately harvest to start the balance/energy sync
          setTimeout(doHarvest, 500);
        } else if (res.cooldownRemaining && res.cooldownRemaining > 0) {
          setMiningCooldown(res.cooldownRemaining);
        }
      }
    } catch (err) {
      console.error('[TOGGLE_MINING] error:', err);
    }
  }, [isVerified, isMining, miningCooldown, actions, doHarvest]);

  const handleVerificationSuccess = useCallback(async () => {
    const res = await actions.doVerifyPayment('verification');
    if (res && res.isVerified) {
      setIsVerified(true);
      localStorage.setItem('mining_verified', 'true');
      setShowVerification(false);
      const mineRes = await actions.startMining();
      if (mineRes.success) setIsMining(true);
    }
  }, [actions]);

  const handleAcceptPrivacy = useCallback(() => {
    setShowPrivacy(false);
    localStorage.setItem('privacy_accepted', 'true');
  }, []);

  const handleUpgrade = useCallback(async (upgradeId: string) => {
    const res = await actions.purchaseUpgrade(upgradeId);
    if (res) {
      setBalance(res.balance);
      setMaxEnergy(res.maxEnergy);
      setUpgrades(prev => prev.map(u => u.id === upgradeId ? { ...u, currentLevel: res.newLevel } : u));
    }
  }, [actions]);

  const handleUpgradeMax = useCallback(async () => {
    let keepBuying = true;
    while (keepBuying) {
      keepBuying = false;
      for (const u of upgrades) {
        if (u.currentLevel >= u.maxLevel) continue;
        const res = await actions.purchaseUpgrade(u.id);
        if (res) {
          setBalance(res.balance);
          setMaxEnergy(res.maxEnergy);
          setUpgrades(prev => prev.map(up => up.id === u.id ? { ...up, currentLevel: res.newLevel } : up));
          keepBuying = true;
          // Add delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }, [actions, upgrades]);

  const handleAscend = useCallback(async () => {
    const res = await actions.doAscend();
    if (res) {
      setGeneration(res.generation);
      setBalance(res.balance);
      setEnergy(res.energy);
      setIsMining(false);
      await refreshState();
    }
  }, [actions, refreshState]);

  const handleFight = useCallback((wager: number, isWin: boolean, serverBalance?: number, serverFightsLeft?: number) => {
    setAggressorLevel(prev => Math.min(100, prev + 15));
    if (serverBalance !== undefined) {
      setBalance(serverBalance);
    } else {
      const fee = wager * 0.15;
      if (isWin) { setBalance(prev => prev + (wager * 1.5 - fee)); }
      else { setBalance(prev => Math.max(0, prev - (wager + fee))); }
    }
    if (serverFightsLeft !== undefined) {
      setFightsLeft(serverFightsLeft);
    } else {
      setFightsLeft(prev => Math.max(0, prev - 1));
    }
  }, []);

  const handleBuyFights = useCallback(async () => {
    const res = await actions.doVerifyPayment('fight_refill');
    if (res) setFightsLeft(res.fightsLeft);
  }, [actions]);

  const handleSaveExtraction = useCallback((wager: number) => {
    const fee = wager * 0.15;
    setBalance(prev => prev + (wager + fee));
  }, []);

  // ─── Loading screen ───
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-6">
        <ParticleBackground />
        <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.4em] font-black">Syncing_Protocol...</span>
      </div>
    );
  }

  // ─── No Telegram context screen ───
  if (authError && authError.includes('Telegram WebApp')) {
    return <TelegramOnly botUsername={botUsername} />;
  }

  // ─── Auth error screen ───
  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-6 px-8">
        <ParticleBackground />
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-2xl">!</div>
        <p className="text-xs font-mono text-white/40 text-center uppercase">{authError}</p>
        <button onClick={retryAuth} className="px-6 py-3 bg-primary text-black font-black rounded-2xl uppercase text-sm active:scale-95 transition-transform">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary selection:text-black pb-32">
      <ParticleBackground />
      <Header username={username} onOpenProfile={() => setProfileModal({ isOpen: true, data: null, isPublic: false })} onOpenSettings={() => setIsSettingsOpen(true)} onOpenNotifications={() => setIsNotificationsOpen(true)} onOpenShop={() => setIsShopOpen(true)} hasUnread={hasUnreadNotifications} isVerified={isVerified} />
      <main className="container max-w-[420px] mx-auto px-5 pt-20 relative z-10">
        {activeTab === Tab.MINE && <MineTab isMining={isMining} toggleMining={handleToggleMining} energy={energy} maxEnergy={maxEnergy} balance={balance} miningCooldown={miningCooldown} onOpenPayment={(type) => setPaymentModal({ isOpen: true, type })} onOpenBlockDetail={(block) => setSelectedBlock(block)} onOpenNetwork={() => setIsNetworkModalOpen(true)} currentNetwork={currentNetwork} generation={generation} upgrades={upgrades} rank={myMonthRank} onlineCount={onlineCount} autoMining={autoMining} autoMiningRemaining={autoMiningRemaining} turboActive={turboActive} turboRemaining={turboRemaining} />}
        {activeTab === Tab.FIGHT && <FightsTab balance={balance} energy={energy} fightsLeft={fightsLeft} extraFights={extraFights} generation={generation} totalLevels={totalLevels} aggressorLevel={aggressorLevel} onlineCount={onlineCount} telegramId={telegramId} onFight={handleFight} onBuyFights={handleBuyFights} onSaveExtraction={handleSaveExtraction} />}
        {activeTab === Tab.TOP && <TopTab onOpenUser={(user) => setProfileModal({ isOpen: true, data: user, isPublic: user.isCurrentUser ? false : true })} balance={balance} networth={networth} rank={myRank} monthRank={myMonthRank} weekEarned={weekEarned} monthEarned={monthEarned} peakWeekRank={myPeakWeekRank} peakMonthRank={myPeakMonthRank} peakAllTimeRank={myPeakAllTimeRank} />}
        {activeTab === Tab.HUB && <HubTab onOpenFriend={(friend) => setProfileModal({ isOpen: true, data: friend, isPublic: true })} botUsername={botUsername} />}
        {activeTab === Tab.EARN && <EarnTab initialQuests={quests} />}
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} upgrades={upgrades} balance={balance} generation={generation} onUpgrade={handleUpgrade} onUpgradeMax={handleUpgradeMax} onAscend={handleAscend} />
      <ProfileModal
        isOpen={profileModal.isOpen}
        onClose={() => setProfileModal({ isOpen: false, data: null, isPublic: false })}
        username={profileModal.data?.username || username}
        balance={profileModal.data?.balance || balance}
        networth={profileModal.data?.networth || networth}
        weekEarned={!profileModal.isPublic ? weekEarned : (profileModal.data?.weekEarned ?? 0)}
        monthEarned={!profileModal.isPublic ? monthEarned : (profileModal.data?.monthEarned ?? 0)}
        generation={profileModal.data?.generation || generation}
        isPublic={profileModal.isPublic}
        rank={profileModal.isPublic ? (profileModal.data?.rank ?? 0) : myRank}
        weekRank={profileModal.isPublic ? (profileModal.data?.rank ?? 0) : myWeekRank}
        monthRank={profileModal.isPublic ? (profileModal.data?.rank ?? 0) : myMonthRank}
        allTimeRank={profileModal.isPublic ? (profileModal.data?.rank ?? 0) : myAllTimeRank}
        peakWeekRank={!profileModal.isPublic ? myPeakWeekRank : 0}
        peakMonthRank={!profileModal.isPublic ? myPeakMonthRank : 0}
        peakAllTimeRank={!profileModal.isPublic ? myPeakAllTimeRank : 0}
        referrals={profileModal.data?.referrals || 0}
        hashRate={profileModal.data?.hashRate || 0}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} notifications={notifications} />
      <PaymentModal isOpen={paymentModal.isOpen} onClose={() => setPaymentModal({ isOpen: false, type: null })} type={paymentModal.type} telegramId={telegramId} maxEnergy={maxEnergy} onPaymentSuccess={(pType) => {
        if (pType === 'autobot') {
          setAutoMining(true);
          setAutoMiningRemaining(86400);
          setIsMining(true);
        } else if (pType === 'multitap') {
          setTurboActive(true);
          setTurboRemaining(86400);
        } else if (pType === 'energy_boost') {
          setEnergy(maxEnergy);
        }
        doHarvest();
      }} />
      <NetworkModal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)} currentTier={currentNetwork} balance={balance} onSelect={setCurrentNetwork} telegramId={telegramId} onPaymentSuccess={() => refreshState()} />
      <BlockDetailModal isOpen={!!selectedBlock} onClose={() => setSelectedBlock(null)} block={selectedBlock} />
      <PrivacyModal isOpen={showPrivacy} onAccept={handleAcceptPrivacy} />
      <VerificationModal isOpen={showVerification} onClose={() => setShowVerification(false)} onSuccess={handleVerificationSuccess} />
    </div>
  );
};

export default App;
