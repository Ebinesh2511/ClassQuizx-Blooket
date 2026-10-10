import { mount } from 'svelte';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './app.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app') });
