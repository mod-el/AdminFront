<?php
if (!$this->options['visualizer'])
	return;

$this->options['visualizer']->print([
    'list' => $this->options['list'],
    'sortedBy' => $this->options['sortedBy'],
    'draggable' => $this->options['draggable'],
]);
