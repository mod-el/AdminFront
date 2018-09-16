<?php
if (!isset($visualizer) or !$visualizer)
	return;

$visualizer->print([
	'list' => $list,
	'sortedBy' => $sortedBy,
	'draggable' => $draggable,
]);
