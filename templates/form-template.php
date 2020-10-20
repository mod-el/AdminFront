<?php
$form = $this->model->_Admin->getForm();
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

foreach ($this->model->_Admin->sublists as $s) {
	echo '<hr />';
	$this->model->_AdminFront->renderSublist($s['name'], $s['options']);
}
