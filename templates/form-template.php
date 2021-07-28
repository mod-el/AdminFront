<?php
if (!$form) {
	echo 'Can\'t find neither a custom template nor a form to render; fix your admin page configuration';
	return;
}

if ($this->model->_Admin->getPageOptions()['visualizer'] === 'FormList' or isset($this->model->_AdminFront->request[2])) {
	$form->render();
} else {
	if ($this->model->isLoaded('Multilang')) {
		$hasMultilang = false;
		foreach ($form->getDataset() as $d) {
			if ($d->options['multilang'])
				$hasMultilang = true;
		}

		if ($hasMultilang)
			$form->renderLangSelector();
	}

	$form->render();

	foreach ($this->model->_Admin->getSublists() as $sublistName => $sublist) {
		echo '<hr />';
		echo '<b>' . entities($sublist['label']) . '</b><br/>';
		$this->model->_AdminFront->renderSublist($sublistName);
	}
}
