(function() {
  const config = window.LeadspotChatConfig;
  if (!config || !config.token) {
    console.error("Leadspot AI: Missing configuration or token.");
    return;
  }

  const iframe = document.createElement('iframe');
  
  const params = new URLSearchParams({
    token: config.token,
    botName: config.botName || 'AI Agent',
    botSubtitle: config.botSubtitle || 'Online',
    themeColor: config.themeColor ? config.themeColor.replace('#', '') : '2563eb',
    fontFamily: config.fontFamily || 'Inter',
    avatarUrl: config.avatarUrl || ''
  });

  iframe.src = `https://leadspot-crm-52ab4.web.app/live-chat?${params.toString()}`;
  
  iframe.style.position = 'fixed';
  iframe.style.bottom = '0px';
  iframe.style[config.position === 'left' ? 'left' : 'right'] = '0px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '2147483647'; 
  iframe.style.backgroundColor = 'transparent';
  iframe.style.colorScheme = 'normal'; 
  iframe.setAttribute('allowtransparency', 'true');
  iframe.allow = 'microphone';
  
  // Start with room for the Launcher + Tooltip
  iframe.style.width = '350px'; 
  iframe.style.height = '150px';

  document.body.appendChild(iframe);

  // Instantly resize the iframe bounds, allowing the internal React app to animate smoothly
  window.addEventListener('message', (event) => {
    if (event.data.type === 'LEADSPOT_EXPAND') {
      if (window.innerWidth <= 480) {
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
      } else {
        iframe.style.width = '420px';  
        iframe.style.height = 'min(800px, 100vh)'; 
      }
    } else if (event.data.type === 'LEADSPOT_COLLAPSE') {
      iframe.style.width = '350px'; 
      iframe.style.height = '150px';
    }
  });
})();