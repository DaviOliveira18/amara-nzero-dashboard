export const DARK = {
  bg:'#04090f', panel:'#070e1b', card:'#0a1628', border:'#1a2e4a',
  green:'#00e5a0', text:'#f1f5f9', muted:'#64748b', dim:'#334155',
  grad:'linear-gradient(135deg,#00c27b,#005c35)',
  accent:'#00e5a0',
}
export const LIGHT = {
  bg:'#f0f4f8', panel:'#e8edf5', card:'#ffffff', border:'#cbd5e1',
  green:'#059669', text:'#0f172a', muted:'#475569', dim:'#94a3b8',
  grad:'linear-gradient(135deg,#059669,#047857)',
  accent:'#059669',
}
export const getTheme = (dark) => dark ? DARK : LIGHT