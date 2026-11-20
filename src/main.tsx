import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import './styles/app.css';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>,
);
