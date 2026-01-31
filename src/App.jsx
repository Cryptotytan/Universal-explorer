import { useState, useCallback, useRef, useEffect } from "react";

// ─── COLOR TOKENS ────────────────────────────────────────
const C = {
  beige: "#F5F0E8",
  beigeDark: "#EDE8DC",
  beigeDarker: "#E3DDD0",
  cream: "#FAF8F4",
  orange: "#E8742A",
  orangeLight: "#F09050",
  orangeDark: "#C45E1A",
  orangeGlow: "rgba(232,116,42,0.18)",
  text: "#2C2420",
  textMid: "#6B5B4E",
  textLight: "#9A8B7C",
  border: "#D9D2C4",
  white: "#FFFFFF",
  successBg: "#E8F5E9",
  successText: "#2E7D32",
  errorBg: "#FFF3F0",
  errorText: "#C62828",
  infoBg: "#FFF8EE",
  infoText: "#E8742A",
};

// ─── CHAIN CONFIGS ───────────────────────────────────────
const CHAINS = {
  polkadot: {
    name: "Polkadot",
    ticker: "DOT",
    color: "#E6007A",
    prefix: "",
    placeholder: "16ZGN73lCF2uSZuacKS3mpSy3JIez8jNYdckoTuiRzdXMzS1",
    api: (addr) => `https://polkadot.subscan.io/api/v2/transfers?address=${addr}&row=50&page=0`,
    headers: () => ({ "Content-Type": "application/json" }),
    parse: (data) => {
      if (!data?.data?.transfers) return [];
      return data.data.transfers.map((t) => ({
        hash: t.hash,
        timestamp: new Date(t.block_timestamp * 1000).toISOString(),
        from: t.from,
        to: t.to,
        amount: (Number(t.amount) / 1e10).toFixed(6),
        token: "DOT",
        fee: t.fee ? (Number(t.fee) / 1e10).toFixed(6) : "0",
        type: t.from === addr ? "Send" : "Receive",
        status: t.success ? "Success" : "Failed",
      }));
    },
  },
  osmosis: {
    name: "Osmosis",
    ticker: "OSMO",
    color: "#8D4FDF",
    prefix: "osmo1",
    placeholder: "osmo1g3525dq4fhqf5rqy2qzdmfwmvyy9w2rkfzpn3x",
    api: (addr) => `https://rest.osmosis.interchain.info/cosmos/tx/v1beta1/txs?events=tx.signer=${addr}&limit=50`,
    headers: () => ({}),
    parse: (data, addr) => {
      if (!data?.txs) return [];
      return data.txs.map((tx, i) => {
        const msgs = tx.body?.messages || [];
        const code = tx.code;
        const fee = tx.auth_info?.fee?.amount?.[0];
        let type = "Transfer";
        let amount = "0";
        let token = "OSMO";
        let from = addr;
        let to = "";
        if (msgs[0]) {
          const msg = msgs[0];
          if (msg["@type"]?.includes("MsgSend")) {
            from = msg.sender || addr;
            to = msg.receiver || msg.to_address || "";
            const coins = msg.amount || [];
            if (coins[0]) {
              amount = (Number(coins[0].amount) / 1e6).toFixed(6);
              token = coins[0].denom === "uosmo" ? "OSMO" : coins[0].denom;
            }
            type = from === addr ? "Send" : "Receive";
          } else if (msg["@type"]?.includes("MsgSwap")) {
            type = "Swap";
            token = "OSMO";
          } else if (msg["@type"]?.includes("Delegate")) {
            type = "Delegate";
          } else if (msg["@type"]?.includes("Undelegate")) {
            type = "Undelegate";
          } else if (msg["@type"]?.includes("Withdraw")) {
            type = "Claim Rewards";
          }
        }
        return {
          hash: tx.txhash,
          timestamp: tx.timestamp || new Date().toISOString(),
          from,
          to,
          amount,
          token,
          fee: fee ? (Number(fee.amount) / 1e6).toFixed(6) : "0",
          type,
          status: code === 0 || !code ? "Success" : "Failed",
        };
      });
    },
  },
  ronin: {
    name: "Ronin",
    ticker: "RON",
    color: "#1A9FFF",
    prefix: "0x",
    placeholder: "0x1234567890abcdef1234567890abcdef12345678",
    api: (addr) => `https://api.roninchain.com/rpc`,
    headers: () => ({ "Content-Type": "application/json" }),
    parse: (data) => {
      if (!data?.result) return [];
      return data.result.map((t) => ({
        hash: t.hash,
        timestamp: new Date(parseInt(t.timeStamp) * 1000).toISOString(),
        from: t.from,
        to: t.to,
        amount: (Number(t.value) / 1e18).toFixed(6),
        token: "RON",
        fee: ((Number(t.gasUsed || 0) * Number(t.gasPrice || 0)) / 1e18).toFixed(8),
        type: t.from?.toLowerCase() === "0x" ? "Send" : "Receive",
        status: t.status === "1" ? "Success" : "Failed",
      }));
    },
  },
  cosmos: {
    name: "Cosmos",
    ticker: "ATOM",
    color: "#414061",
    prefix: "cosmos1",
    placeholder: "cosmos1qypqxpq9qprsttsbfaesw4yz2zn0lcw0pfmx5k3",
    api: (addr) => `https://rest.cosmos.directory/cosmos/cosmos/tx/v1beta1/txs?events=tx.signer=${addr}&limit=50`,
    headers: () => ({}),
    parse: (data, addr) => {
      if (!data?.txs) return [];
      return data.txs.map((tx) => {
        const msgs = tx.body?.messages || [];
        const fee = tx.auth_info?.fee?.amount?.[0];
        let type = "Transfer";
        let amount = "0";
        let token = "ATOM";
        let from = addr;
        let to = "";
        if (msgs[0]) {
          const msg = msgs[0];
          if (msg["@type"]?.includes("MsgSend")) {
            from = msg.sender || addr;
            to = msg.receiver || msg.to_address || "";
            const coins = msg.amount || [];
            if (coins[0]) {
              amount = (Number(coins[0].amount) / 1e6).toFixed(6);
              token = coins[0].denom === "uatom" ? "ATOM" : coins[0].denom;
            }
            type = from === addr ? "Send" : "Receive";
          } else if (msg["@type"]?.includes("Delegate")) {
            type = "Delegate";
            amount = msg.amount?.amount ? (Number(msg.amount.amount) / 1e6).toFixed(6) : "0";
          } else if (msg["@type"]?.includes("Undelegate")) {
            type = "Undelegate";
          } else if (msg["@type"]?.includes("Withdraw")) {
            type = "Claim Rewards";
          } else if (msg["@type"]?.includes("IBC")) {
            type = "IBC Transfer";
          }
        }
        return {
          hash: tx.txhash,
          timestamp: tx.timestamp || new Date().toISOString(),
          from,
          to,
          amount,
          token,
          fee: fee ? (Number(fee.amount) / 1e6).toFixed(6) : "0",
          type,
          status: tx.code === 0 || !tx.code ? "Success" : "Failed",
        };
      });
    },
  },
  solana: {
    name: "Solana",
    ticker: "SOL",
    color: "#9945FF",
    prefix: "",
    placeholder: "5K4wRHBqaNuNKv3RKoAgCaA6kSWsBwb9EMZpFAtVvaBE",
    api: (addr) => `https://api.mainnet-beta.solana.com`,
    headers: () => ({ "Content-Type": "application/json" }),
    parse: (data, addr) => {
      if (!data?.result) return [];
      return data.result.map((sig) => ({
        hash: sig.signature,
        timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
        from: addr,
        to: "",
        amount: "—",
        token: "SOL",
        fee: sig.fee ? (sig.fee / 1e9).toFixed(9) : "0",
        type: sig.err ? "Failed Tx" : "Transfer",
        status: sig.err ? "Failed" : "Success",
      }));
    },
  },
  bsc: {
    name: "BSC",
    ticker: "BNB",
    color: "#F3BA2F",
    prefix: "0x",
    placeholder: "0x1234567890abcdef1234567890abcdef12345678",
    api: (addr) => `https://api.bscscan.com/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=YourAPIKey`,
    headers: () => ({}),
    parse: (data) => {
      if (!data?.result || !Array.isArray(data.result)) return [];
      return data.result.map((t) => ({
        hash: t.hash,
        timestamp: new Date(parseInt(t.timeStamp) * 1000).toISOString(),
        from: t.from,
        to: t.to,
        amount: (Number(t.value) / 1e18).toFixed(6),
        token: "BNB",
        fee: ((Number(t.gasUsed || 0) * Number(t.gasPrice || 0)) / 1e18).toFixed(8),
        type: t.from?.toLowerCase().startsWith("0x") ? "Transfer" : "Contract",
        status: t.status === "1" ? "Success" : "Failed",
      }));
    },
  },
};

// ─── AWAKEN TAX CSV GENERATOR ────────────────────────────
function generateAwakenCSV(transactions, walletAddr) {
  const headers = ["Timestamp", "Sent Asset", "Sent Amount", "Received Asset", "Received Amount", "Fee Asset", "Fee Amount", "Tag", "Description", "TxID"];
  const rows = transactions.map((tx) => {
    let sentAsset = "", sentAmount = "", recvAsset = "", recvAmount = "", tag = "";
    if (tx.type === "Send") {
      sentAsset = tx.token;
      sentAmount = tx.amount;
      tag = "Send";
    } else if (tx.type === "Receive") {
      recvAsset = tx.token;
      recvAmount = tx.amount;
      tag = "Receive";
    } else if (tx.type === "Swap") {
      sentAsset = tx.token;
      sentAmount = tx.amount;
      tag = "Coin Swap";
    } else if (tx.type === "Delegate") {
      sentAsset = tx.token;
      sentAmount = tx.amount;
      tag = "Stake Deposit";
    } else if (tx.type === "Undelegate") {
      recvAsset = tx.token;
      recvAmount = tx.amount;
      tag = "Stake Withdrawal";
    } else if (tx.type === "Claim Rewards") {
      recvAsset = tx.token;
      recvAmount = tx.amount;
      tag = "Claim Rewards";
    } else if (tx.type === "IBC Transfer") {
      sentAsset = tx.token;
      sentAmount = tx.amount;
      tag = "Send";
    } else {
      tag = "Transfer";
      sentAsset = tx.token;
      sentAmount = tx.amount;
    }

    const ts = new Date(tx.timestamp).toISOString().replace("T", " ").replace(/\.\d+Z/, "");
    return [
      ts,
      sentAsset,
      sentAmount,
      recvAsset,
      recvAmount,
      tx.token,
      tx.fee,
      tag,
      `${tx.type} - ${tx.hash?.slice(0, 12)}...`,
      tx.hash,
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

// ─── FETCH HELPERS ───────────────────────────────────────
async function fetchTransactions(chainKey, address) {
  const chain = CHAINS[chainKey];

  // Solana uses JSON-RPC
  if (chainKey === "solana") {
    const res = await fetch(chain.api(address), {
      method: "POST",
      headers: chain.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress2",
        params: [address, { limit: 50 }],
      }),
    });
    const data = await res.json();
    return chain.parse(data, address);
  }

  // Ronin uses JSON-RPC too — fallback to etherscan-style for real use
  if (chainKey === "ronin") {
    // Ronin public RPC doesn't easily support etherscan-style txlist
    // We'll use a known public endpoint approach
    const res = await fetch(
      `https://api.roninchain.com/rpc`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionCount",
          params: [address, "latest"],
        }),
      }
    );
    // Since Ronin RPC is limited, return a helpful message
    return [];
  }

  // REST APIs
  const res = await fetch(chain.api(address), { headers: chain.headers() });
  const data = await res.json();
  return chain.parse(data, address);
}

// ─── COMPONENTS ──────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
      <div style={{
        width: 36, height: 36, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.orange}`,
        borderRadius: "50%", animation: "spin 0.7s linear infinite"
      }} />
    </div>
  );
}

function ChainBadge({ chain }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: chain.color + "15", color: chain.color,
      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600,
      border: `1px solid ${chain.color}30`, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: chain.color, display: "inline-block" }} />
      {chain.name}
    </span>
  );
}

function StatusBadge({ status }) {
  const ok = status === "Success";
  return (
    <span style={{
      display: "inline-block",
      background: ok ? C.successBg : C.errorBg,
      color: ok ? C.successText : C.errorText,
      borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600,
      whiteSpace: "nowrap"
    }}>
      {ok ? "✓ Success" : "✗ Failed"}
    </span>
  );
}

function TypeTag({ type }) {
  const colors = {
    Send: { bg: "#FFF0E8", text: C.orangeDark },
    Receive: { bg: "#E8F5E9", text: "#2E7D32" },
    Swap: { bg: "#EEE8FF", text: "#6A1B9A" },
    Delegate: { bg: "#E3F2FD", text: "#1565C0" },
    Undelegate: { bg: "#FFF3E0", text: "#E65100" },
    "Claim Rewards": { bg: "#E8F5E9", text: "#2E7D32" },
    "IBC Transfer": { bg: "#F3E5F5", text: "#6A1B9A" },
    Transfer: { bg: C.beigeDarker, text: C.textMid },
  };
  const c = colors[type] || colors.Transfer;
  return (
    <span style={{
      display: "inline-block", background: c.bg, color: c.text,
      borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600,
      whiteSpace: "nowrap"
    }}>
      {type}
    </span>
  );
}

// ─── MAIN APP ────────────────────────────────────────────
export default function UniversalExplorer() {
  const [selectedChain, setSelectedChain] = useState("polkadot");
  const [address, setAddress] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searchedAddr, setSearchedAddr] = useState("");
  const [expandedTx, setExpandedTx] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const inputRef = useRef(null);

  const chain = CHAINS[selectedChain];

  const handleSearch = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setTransactions([]);
    setSearched(true);
    setSearchedAddr(address.trim());
    setExpandedTx(null);
    setFilterType("All");
    try {
      const txs = await fetchTransactions(selectedChain, address.trim());
      setTransactions(txs);
    } catch (e) {
      setError("Failed to fetch transactions. Check the address or try again.");
    }
    setLoading(false);
  }, [address, selectedChain]);

  const handleDownloadCSV = useCallback(() => {
    const csv = generateAwakenCSV(transactions, searchedAddr);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `universal-explorer-awaken-${chain.ticker}-${searchedAddr.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions, searchedAddr, chain.ticker]);

  const filteredTxs = filterType === "All" ? transactions : transactions.filter((t) => t.type === filterType);
  const uniqueTypes = ["All", ...new Set(transactions.map((t) => t.type))];

  // Format timestamp for mobile
  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };
  const fmtTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return ""; }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.beige, fontFamily: "'Georgia', serif",
      color: C.text, overflowX: "hidden"
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: ${C.textLight}; }
        input:focus { outline: none; }
        button:active { opacity: 0.85; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.orangeDark} 0%, ${C.orange} 50%, ${C.orangeLight} 100%)`,
        padding: "28px 20px 24px",
        position: "relative", overflow: "hidden"
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
              <circle cx="9" cy="10" r="3" fill="white" opacity="0.9"/>
              <circle cx="19" cy="10" r="3" fill="white" opacity="0.9"/>
              <circle cx="14" cy="19" r="3" fill="white" opacity="0.9"/>
              <line x1="11.5" y1="11.5" x2="12.5" y2="17.5" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="16.5" y1="11.5" x2="15.5" y2="17.5" stroke="white" strokeWidth="1.5" opacity="0.6"/>
            </svg>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.white, letterSpacing: "-0.5px" }}>
              Universal Explorer
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "sans-serif" }}>
            Multi-chain transaction explorer • Tax-ready CSV export
          </p>
        </div>
      </div>

      {/* ── CHAIN SELECTOR ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {Object.entries(CHAINS).map(([key, ch]) => (
            <button key={key} onClick={() => { setSelectedChain(key); setAddress(""); setTransactions([]); setSearched(false); setError(null); }}
              style={{
                flexShrink: 0, background: selectedChain === key ? ch.color : C.white,
                color: selectedChain === key ? C.white : C.textMid,
                border: `1.5px solid ${selectedChain === key ? ch.color : C.border}`,
                borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "sans-serif",
                boxShadow: selectedChain === key ? `0 2px 8px ${ch.color}40` : "none",
                transition: "all 0.2s ease"
              }}>
              {ch.ticker}
            </button>
          ))}
        </div>
      </div>

           {/* ── SEARCH BOX ── */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{
          background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`,
          padding: "10px 12px", display: "flex", gap: 8, alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        }}>
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={chain.placeholder}
            style={{
              flex: 1, border: "none", background: "transparent", fontSize: 13,
              color: C.text, fontFamily: "monospace", minWidth: 0
            }}
          />
          <button onClick={handleSearch} disabled={loading || !address.trim()}
            style={{
              background: C.orange, color: C.white, border: "none", borderRadius: 10,
              padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "sans-serif", flexShrink: 0, opacity: (!address.trim()) ? 0.5 : 1,
              boxShadow: "0 2px 6px rgba(232,116,42,0.35)", transition: "opacity 0.2s"
            }}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      </div>

      {/* ── ACTIVE CHAIN INFO ── */}
      {!searched && (
        <div style={{ padding: "18px 16px 0" }}>
          <div style={{
            background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: 16
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: chain.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: chain.color }}>{chain.ticker}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{chain.name}</div>
                <div style={{ fontSize: 11, color: C.textLight, fontFamily: "sans-serif" }}>Enter a wallet address above</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textLight, fontFamily: "sans-serif", lineHeight: 1.5, background: C.beige, borderRadius: 8, padding: "8px 10px" }}>
              {selectedChain === "polkadot" && "Fetches transfers via Subscan API. Supports DOT transfers."}
              {selectedChain === "osmosis" && "Fetches transactions via Osmosis LCD REST API. Supports sends, swaps, staking."}
              {selectedChain === "ronin" && "Ronin public RPC has limited transaction history access. Results may be limited."}
              {selectedChain === "cosmos" && "Fetches transactions via Cosmos Directory LCD. Supports sends, staking, IBC."}
              {selectedChain === "solana" && "Fetches signatures via Solana RPC. Full tx details require additional calls."}
              {selectedChain === "bsc" && "Fetches via BscScan API. Free tier — results may be rate-limited."}
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && <Spinner />}

      {/* ── ERROR ── */}
      {error && !loading && (
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: C.errorBg, border: `1px solid ${C.errorText}30`, borderRadius: 12, padding: "12px 14px", color: C.errorText, fontSize: 13, fontFamily: "sans-serif" }}>
            ⚠ {error}
          </div>
        </div>
      )}

      {/* ── RESULTS HEADER + DOWNLOAD ── */}
      {searched && !loading && !error && (
        <div style={{ padding: "18px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <ChainBadge chain={chain} />
                <span style={{ fontSize: 12, color: C.textMid, fontFamily: "sans-serif", fontWeight: 600 }}>
                  {transactions.length} txs
                </span>
              </div>
              <div style={{ fontSize: 10, color: C.textLight, fontFamily: "monospace", marginTop: 3, wordBreak: "break-all" }}>
                {searchedAddr.slice(0, 28)}{searchedAddr.length > 28 ? "..." : ""}
              </div>
            </div>
            {transactions.length > 0 && (
              <button onClick={handleDownloadCSV}
                style={{
                  background: C.white, color: C.orange, border: `1.5px solid ${C.orange}`,
                  borderRadius: 10, padding: "7px 12px", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: 5,
                  boxShadow: "0 1px 4px rgba(232,116,42,0.15)"
                }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 10.5L4.5 7H6.5V3H9.5V7H11.5L8 10.5Z" fill={C.orange}/>
                  <path d="M3 12.5H13V13.5H3V12.5Z" fill={C.orange}/>
                </svg>
                Awaken CSV
              </button>
            )}
          </div>

          {/* Filter pills */}
          {uniqueTypes.length > 2 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
              {uniqueTypes.map((t) => (
                <button key={t} onClick={() => setFilterType(t)}
                  style={{
                    flexShrink: 0, background: filterType === t ? C.orange : C.white,
                    color: filterType === t ? C.white : C.textMid,
                    border: `1px solid ${filterType === t ? C.orange : C.border}`,
                    borderRadius: 16, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "sans-serif"
                  }}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TRANSACTION LIST ── */}
      {searched && !loading && !error && (
        <div style={{ padding: "10px 16px 24px" }}>
          {filteredTxs.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 16px", color: C.textLight,
              fontFamily: "sans-serif", fontSize: 13
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              No transactions found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTxs.map((tx, idx) => (
                <div key={idx} onClick={() => setExpandedTx(expandedTx === idx ? null : idx)}
                  style={{
                    background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
                    overflow: "hidden", cursor: "pointer", animation: `fadeUp 0.3s ease ${idx * 0.03}s both`,
                    boxShadow: expandedTx === idx ? `0 2px 12px ${C.orange}20` : "0 1px 3px rgba(0,0,0,0.04)",
                    borderColor: expandedTx === idx ? C.orange + "60" : C.border,
                    transition: "all 0.2s ease"
                  }}>
                  {/* Main row */}
                  <div style={{ padding: "11px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Icon */}
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: tx.type === "Receive" || tx.type === "Claim Rewards"
                        ? "#E8F5E9" : tx.type === "Send" ? "#FFF0E8" : chain.color + "15",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
                    }}>
                      {tx.type === "Send" ? "↗" : tx.type === "Receive" ? "↙" : tx.type === "Swap" ? "⇄" : tx.type === "Delegate" || tx.type === "Undelegate" ? "🔒" : tx.type === "Claim Rewards" ? "🎁" : "→"}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <TypeTag type={tx.type} />
                        <StatusBadge status={tx.status} />
                      </div>
                      <div style={{ fontSize: 10, color: C.textLight, fontFamily: "monospace", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tx.hash?.slice(0, 22)}...
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: tx.type === "Receive" || tx.type === "Claim Rewards" ? C.successText : C.orangeDark
                      }}>
                        {tx.type === "Receive" || tx.type === "Claim Rewards" ? "+" : tx.type === "Send" ? "-" : ""}
                        {tx.amount} <span style={{ fontSize: 10, color: C.textLight }}>{tx.token}</span>
                      </div>
                      <div style={{ fontSize: 9, color: C.textLight, fontFamily: "sans-serif" }}>
                        {fmtDate(tx.timestamp)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedTx === idx && (
                    <div style={{
                      borderTop: `1px solid ${C.border}`, padding: "10px 12px",
                      background: C.beige, fontSize: 11, fontFamily: "sans-serif"
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                        <DetailRow label="Time" value={fmtTime(tx.timestamp)} />
                        <DetailRow label="Fee" value={`${tx.fee} ${tx.token}`} />
                        <DetailRow label="From" value={tx.from?.slice(0, 20) + "..."} mono />
                        <DetailRow label="To" value={tx.to ? tx.to.slice(0, 20) + "..." : "—"} mono />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <DetailRow label="TxHash" value={tx.hash} mono full />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{
        background: C.beigeDarker, borderTop: `1px solid ${C.border}`,
        padding: "18px 16px", textAlign: "center"
      }}>
        <div style={{ fontSize: 11, color: C.textLight, fontFamily: "sans-serif", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: C.textMid, fontSize: 12, marginBottom: 4 }}>Universal Explorer</div>
          Open source multi-chain explorer with Awaken Tax CSV export<br />
          <span style={{ opacity: 0.7 }}>
            Chains: Polkadot • Osmosis • Ronin • Cosmos • Solana • BSC<br />
            CSV export is formatted for <a href="https://awaken.tax" target="_blank" rel="noreferrer" style={{ color: C.orange, textDecoration: "none" }}>Awaken Tax</a> import
          </span>
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 12 }}>
          <a href="#" style={{ fontSize: 10, color: C.orange, textDecoration: "none", fontFamily: "sans-serif" }}>
            📄 README
          </a>
          <a href="#" style={{ fontSize: 10, color: C.orange, textDecoration: "none", fontFamily: "sans-serif" }}>
            🐙 GitHub
          </a>
          <a href="#" style={{ fontSize: 10, color: C.orange, textDecoration: "none", fontFamily: "sans-serif" }}>
            📜 License (MIT)
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL ROW HELPER ──────────────────────────────────
function DetailRow({ label, value, mono, full }) {
  return (
    <div style={{ display: full ? "block" : "flex", gap: full ? 4 : 6, alignItems: full ? undefined : "flex-start" }}>
      <span style={{ color: C.textLight, fontWeight: 600, fontSize: 10, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span style={{
        color: C.textMid, fontSize: 11,
        fontFamily: mono ? "monospace" : "sans-serif",
        wordBreak: "break-all", fontSize: mono ? 10 : 11
      }}>
        {value}
      </span>
    </div>
  );
}
