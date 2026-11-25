/* ===== 설정: 폰트 / 프리셋 / 홍보 정보는 이 파일만 고치면 됩니다 ===== */
const MAX_SIDE = 4000;                 // 이미지 한 변 최대 px (넘으면 자동 축소)
const MAX_IMAGES = matchMedia('(pointer:coarse)').matches ? 10 : 20;   // 모바일은 메모리 때문에 10장
const MAX_FILE_MB = 40;                // 이 크기를 넘는 파일은 불러오지 않음
const MAX_PIXELS = 120e6;              // 가로×세로가 이 값을 넘는 이미지는 불러오지 않음

const PROMO = {
  text: '사이트 제작자: 감튀 @frypotato_CM',
  shareUrl: 'https://frypotato-cm.github.io/MovieFrame-maker/',
  links: [
    {label: 'CREPE', name: '크레페', url: 'https://kre.pe/FWPq', icon: './crepe-logo.png'},
    {label: 'X', name: 'X(트위터)', url: 'https://x.com/frypotato_CM', icon: './x-logo.svg'}
  ]
};

// show: 버튼 라벨을 보여줄 글꼴 (한글이 되는 글꼴이어야 보입니다)
const FONTS = {
  ko:[{id:'Nanum Gothic',label:'고딕',show:'Nanum Gothic'},{id:'Noto Serif KR',label:'명조',show:'Noto Serif KR'},{id:'ChosunGu',label:'굴림',show:'ChosunGu'}],
  en:[{id:'Inter',label:'고딕',show:'Nanum Gothic'},{id:'Libre Baskerville',label:'명조',show:'Noto Serif KR'},{id:'Roboto Mono',label:'타자기',show:'Roboto Mono'}],
  ja:[{id:'Noto Sans JP',label:'고딕',show:'Nanum Gothic'},{id:'Noto Serif JP',label:'명조',show:'Noto Serif KR'}],
  zh:[{id:'Noto Sans SC',label:'고딕',show:'Nanum Gothic'},{id:'Noto Serif SC',label:'명조',show:'Noto Serif KR'}]
};
const GOTHIC = {ko:'Nanum Gothic', en:'Inter', ja:'Noto Sans JP', zh:'Noto Sans SC'};
const SERIF  = {ko:'Noto Serif KR', en:'Libre Baskerville', ja:'Noto Serif JP', zh:'Noto Serif SC'};

// 그라데이션 색 팔레트 (이 밖의 색은 색상 코드로 입력)
const GRAD_COLORS = [
  {name:'흰색', hex:'#ffffff'}, {name:'검정', hex:'#000000'}, {name:'빨강', hex:'#e02020'},
  {name:'노랑', hex:'#ffd400'}, {name:'파랑', hex:'#1e50ff'}, {name:'초록', hex:'#20b050'}
];

const DEFAULTS = {
  ratio:1.7778, frameCustom:1.5,                                  // 이미지 비율(자르기)
  zoom:1, px:0, py:0, angle:0, rot:0, flip:false,                 // 이미지별
  lbPreset:0, lbTop:0, lbBot:0, lbLink:true,                      // 레터박스: 0=없음, 숫자=최종 비율, 'custom'=직접
  gray:false, grain:false, grainAmt:35,
  gTop:'none', gTopAmt:50, gTopRange:40, gTopColor:'#000000',
  gBot:'none', gBotAmt:50, gBotRange:40, gBotColor:'#000000',
  weather:'none', wInt:50, wSpeed:1, wDir:10, wSec:3,
  text:'자막을 입력하세요\nType your subtitle here',                // 이미지별
  ...GOTHIC, bold:false, italic:false, align:'center', lsp:0, lh:1.3,
  size:48, pos:'bottom', place:'image', x:0, y:0,
  color:'#ffffff', stroke:true, strokeColor:'#000000', strokeW:3,
  box:false, boxColor:'#000000', boxAlpha:50,
  fmt:'png', q:92, res:'orig'
};
const PER = ['px','py','zoom','angle','rot','flip','text'];   // 이미지마다 따로 저장되는 값
const RESET_GROUPS = {font:['ko','en','ja','zh','bold','italic'], size:['size'], pos:['pos','place','x','y'], gap:['lsp','lh']};

// 자막 스타일 프리셋 (자막 관련 값만 바뀜)
const ST = {
  basic:  {...GOTHIC, bold:false, italic:false, align:'center', size:48, color:'#ffffff', pos:'bottom', place:'image', stroke:true, strokeColor:'#000000', strokeW:3, box:false, boxColor:'#000000', boxAlpha:50, lsp:0, lh:1.3},
  netflix:{...GOTHIC, en:'Roboto Mono', bold:false, italic:false, align:'center', size:48, color:'#ffffff', pos:'bottom', place:'image', stroke:false, strokeColor:'#000000', strokeW:2, box:true, boxColor:'#000000', boxAlpha:50, lsp:1, lh:1.3},
  emotion:{...SERIF, bold:false, italic:true, align:'center', size:48, color:'#ffffff', pos:'bottom', place:'bar', stroke:false, strokeColor:'#000000', strokeW:2, box:false, boxColor:'#000000', boxAlpha:50, lsp:4, lh:1.3},
  retro:  {...SERIF, ko:'ChosunGu', en:'Roboto Mono', bold:false, italic:true, align:'center', size:48, color:'#ffe14d', pos:'bottom', place:'image', stroke:true, strokeColor:'#000000', strokeW:6, box:false, boxColor:'#000000', boxAlpha:50, lsp:1, lh:1.3},
  lyrics: {...GOTHIC, bold:false, italic:false, align:'left', size:48, color:'#ffffff', pos:'bottom', place:'bar', x:0, stroke:true, strokeColor:'#000000', strokeW:3, box:false, boxColor:'#000000', boxAlpha:50, lsp:0, lh:1.3}
};
const STYLE_PRESETS = [{name:'기본', v:ST.basic},{name:'넷플릭스', v:ST.netflix},{name:'감성', v:ST.emotion},{name:'레트로', v:ST.retro},{name:'가사', v:ST.lyrics}];

// 전용 프리셋 (이미지 비율·레터박스·효과·자막 스타일 전부 덮어씀, 이미지·자막 문구 제외) — 이름/값 자유롭게 수정
// ratio = 이미지를 자르는 비율, lbPreset = 레터박스로 맞출 최종 비율(0이면 없음)
const MY_PRESETS = [
  {
    name: '크리스마스(이미지)',
    v: {
      ...ST.retro,
      ratio: 'orig',
      lbPreset: 1.7778,
      grain: true,
      grainAmt: 30,
      gBot: 'dark',
      gBotColor: '#55423e',
      gBotAmt: 36,
      gBotRange: 30
    }
  },
  {
    name: '크리스마스(GIF)',
    v: {
      ...ST.retro,
      ratio: 'orig',
      lbPreset: 1.7778,
      weather: 'snow',
      wInt: 70,
      wSpeed: 0.5,
      gBot: 'dark',
      gBotColor: '#55423e',
      gBotAmt: 36,
      gBotRange: 30
    }
  }
];

const ICONS = {   // 아이콘: Lucide (ISC License)
  bold:'<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>',
  italic:'<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  left:'<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>',
  center:'<line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/>',
  right:'<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'
};
/* ================================================================ */
