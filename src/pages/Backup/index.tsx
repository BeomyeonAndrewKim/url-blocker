import { createRoot } from 'react-dom/client';

import Backup from './Backup';

const container = document.querySelector('#app-container');
if (container) createRoot(container).render(<Backup />);
