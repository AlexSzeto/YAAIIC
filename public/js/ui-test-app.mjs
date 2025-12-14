import { render } from 'preact';
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Button } from './custom-ui/button.mjs';
import { Input } from './custom-ui/input.mjs';
import { Textarea } from './custom-ui/textarea.mjs';
import { Select } from './custom-ui/select.mjs';
import { Checkbox } from './custom-ui/checkbox.mjs';
import { Modal } from './custom-ui/modal.mjs';
import { ToastProvider, useToast } from './custom-ui/toast.mjs';
import { ImageCarousel } from './custom-ui/image-carousel.mjs';

function TestApp() {
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  // Form State
  const [inputValue, setInputValue] = useState('');
  const [checkValue, setCheckValue] = useState(false);
  
  // Carousel State
  const carouselItems = [
    { id: 1, url: 'https://via.placeholder.com/150/0000FF/808080?text=Item+1' },
    { id: 2, url: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Item+2' },
    { id: 3, url: 'https://via.placeholder.com/150/FFFF00/000000?text=Item+3' },
  ];
  const [selectedItem, setSelectedItem] = useState(carouselItems[0]);

  return html`
    <div class="container">
      <h1>UI Component Library Test</h1>

      <section>
        <h2>Buttons</h2>
        <div class="row">
          <${Button} variant="primary">Primary<//>
          <${Button} variant="secondary">Secondary<//>
          <${Button} variant="success" icon="check-circle">Success<//>
          <${Button} variant="danger" icon="trash">Danger<//>
        </div>
        <div class="row">
          <${Button} loading>Loading<//>
          <${Button} disabled>Disabled<//>
          <${Button} variant="icon" icon="copy" title="Copy Icon"><//>
          <${Button} variant="icon-nav" icon="chevron-right" title="Nav Icon"><//>
        </div>
      </section>

      <section>
        <h2>Inputs</h2>
        <div class="grid">
          <${Input} label="Standard Input" placeholder="Type here..." value=${inputValue} onInput=${e => setInputValue(e.target.value)} />
          <${Input} label="Error State" error="This field is required" />
          <${Select} label="Select Option" options=${[{label: 'Option 1', value: 1}, {label: 'Option 2', value: 2}]} />
          <${Textarea} label="Text Area" placeholder="Enter long text..." />
        </div>
        <div style="margin-top: 10px;">
          <p>Input Value: ${inputValue}</p>
        </div>
      </section>

      <section>
        <h2>Checkbox</h2>
        <div class="row">
          <${Checkbox} label="Toggle Me (Custom Dark)" checked=${checkValue} onChange=${e => setCheckValue(e.target.checked)} />
          <${Checkbox} label="Disabled" disabled />
          <${Checkbox} label="Disabled Checked" disabled checked=${true} />
        </div>
        <p>Checked: ${checkValue.toString()}</p>
      </section>

      <section>
        <h2>Modal & Toast</h2>
        <div class="row">
          <${Button} onClick=${() => setModalOpen(true)}>Open Modal<//>
          <${Button} onClick=${() => toast.success('Operation Successful!')} variant="success">Toast Success<//>
          <${Button} onClick=${() => toast.error('Something went wrong')} variant="danger">Toast Error<//>
          <${Button} onClick=${() => toast.info('For your information')} variant="secondary">Toast Info<//>
        </div>

        <${Modal} 
          isOpen=${modalOpen} 
          onClose=${() => setModalOpen(false)} 
          title="Test Modal"
          footer=${html`
            <${Button} variant="secondary" onClick=${() => setModalOpen(false)}>Cancel<//>
            <${Button} variant="primary" onClick=${() => { toast.success('Action Confirmed'); setModalOpen(false); }}>Confirm<//>
          `}
        >
          <p>This is a declarative modal component using React Portals.</p>
          <p>It acts as an overlay on top of the application.</p>
        <//>
      </section>

      <section>
        <h2>Carousel</h2>
        <${ImageCarousel} 
          items=${carouselItems} 
          selectedItem=${selectedItem} 
          onSelect=${setSelectedItem} 
        />
        <p style="margin-top: 10px;">Selected ID: ${selectedItem.id}</p>
      </section>
    </div>
  `;
}

render(html`<${ToastProvider}><${TestApp} /><//>`, document.getElementById('test-root'));
