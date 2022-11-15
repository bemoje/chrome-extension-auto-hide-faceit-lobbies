// option defaults
const defaults = {
   ahfl_hideNotJoinable: true,
   ahfl_hideNotReady: true,
   ahfl_hidePlaying: true,
   ahfl_hideQueuing: true,
   ahfl_enabledOnPageLoad: true,
};

// On page load, restores state using the options stored in chrome.storage.
document.addEventListener('DOMContentLoaded',() => {
   chrome.storage.sync.get(defaults,(items) => {
      document.getElementById('hideNotJoinable').checked = items.ahfl_hideNotJoinable;
      document.getElementById('hideNotReady').checked = items.ahfl_hideNotReady;
      document.getElementById('hidePlaying').checked = items.ahfl_hidePlaying;
      document.getElementById('hideQueuing').checked = items.ahfl_hideQueuing;
      document.getElementById('enabledOnPageLoad').checked = items.ahfl_enabledOnPageLoad;
   });
});

// On 'save' button click, save options to chrome.storage
document.getElementById('save').addEventListener('click',() => {
   const options = {
      ahfl_hideNotJoinable: document.getElementById('hideNotJoinable').checked,
      ahfl_hideNotReady: document.getElementById('hideNotReady').checked,
      ahfl_hidePlaying: document.getElementById('hidePlaying').checked,
      ahfl_hideQueuing: document.getElementById('hideQueuing').checked,
      ahfl_enabledOnPageLoad: document.getElementById('enabledOnPageLoad').checked,
   };
   chrome.storage.sync.set(options,() => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = 'Options saved. Reload (F5) faceit page.';
      setTimeout(() => {
         status.textContent = '';
      },750);
   });
});
