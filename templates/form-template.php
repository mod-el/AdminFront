<?php
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

	foreach ($this->model->_Admin->sublists as $sublistName => $sublist) {
		echo '<hr />';
		echo '<b>' . entities($sublist['label']) . '</b><br/>';
		$this->model->_AdminFront->renderSublist($sublistName);
	}
}
