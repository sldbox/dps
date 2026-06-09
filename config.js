
var DPS_CONFIG={
  storage:{
    version:'20260609_1835_dps_v16_actual_stats_fix',
    scope:'browser_local',
    key:'gbd_dps_calculator:personal_state',
    fontKey:'gbd_dps_calculator:font_scale',
    clientKey:'gbd_dps_calculator:client_id'
  },

  state:{
    skipElementIds:['backupFileInput','dpsTableMinDpsMain','ep']
  },

  dpsTable:{
    difficulties:['Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'],
    rounds:[{round:270,armor:1570},{round:300,armor:2470}],
    defaultRound:270,
    penanceMin:0,
    penanceMax:20,
    decimals:1
  },

  ui:{
    updateDelay:16,
    confirmDelayMs:1600,
    traitHoldInitialDelay:320,
    traitHoldRepeatMs:55,
    traitHoldAccelEvery:7,
    traitHoldMaxStep:50,
    fontScaleDefault:1,
    fontScaleMin:0.9,
    fontScaleMax:2,
    fontScaleStep:0.05,
    mobileMaxWidth:767
  }
};

window.DPS_CONFIG=DPS_CONFIG;
