const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:__dirname,
 testMatch:'*.e2e.cjs',
 fullyParallel:false,
 workers:1,
 retries:0,
 timeout:45000,
 expect:{timeout:15000},
 use:{baseURL:'http://127.0.0.1:8765',headless:true,browserName:'chromium',
   viewport:{width:1280,height:800},trace:'retain-on-failure'},
 webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',
   port:8765,reuseExistingServer:!process.env.CI,timeout:15000},
 reporter:'list'
});
