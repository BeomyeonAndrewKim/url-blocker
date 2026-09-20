import { createRoot } from 'react-dom/client';

import Popup from './Popup';

const container = document.querySelector('#app-container');
if (container) createRoot(container).render(<Popup />);
