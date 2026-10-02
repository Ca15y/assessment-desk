import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',timeout:60000,workers:1,reporter:'list',
  use:{baseURL:'http://127.0.0.1:5173',channel:'chrome',headless:true,acceptDownloads:true},
  webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000},
});
